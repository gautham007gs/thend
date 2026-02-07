import { NextRequest, NextResponse } from 'next/server';
import { mkdir, unlink, writeFile } from 'fs/promises';
import path from 'path';
import MaximumSecurity from '@/lib/enhanced-security';
import { APISecurityManager } from '@/lib/api-security';

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_AUDIO_TYPES = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/ogg'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_UPLOADS_PER_DAY = 50; // Storage quota per user

export async function POST(request: NextRequest) {
  // Apply MAXIMUM security protection
  const enhancedSecurityCheck = await MaximumSecurity.secureRequest(request);
  if (enhancedSecurityCheck) return enhancedSecurityCheck;

  // Verify admin authentication for uploads
  const { requireAdminAuth } = await import('@/lib/auth-utils');
  const authCheck = await requireAdminAuth(request);
  if (!authCheck.authenticated) {
    return authCheck.response;
  }

  // Apply comprehensive API security with strict rate limiting
  const securityCheck = await APISecurityManager.secureAPIRoute(request, {
    allowedMethods: ['POST'],
    rateLimit: { requests: 10, window: 60000 },
    requireAuth: true
  });
  if (securityCheck) return securityCheck;

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const type = formData.get('type') as string; // 'image', 'audio', or 'video'

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!type || !['image', 'audio', 'video'].includes(type)) {
      return NextResponse.json({ error: 'Invalid file type specified' }, { status: 400 });
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: `File size must be less than ${MAX_FILE_SIZE / (1024 * 1024)}MB` }, { status: 400 });
    }

    // Validate file MIME type
    let allowedTypes: string[] = [];
    let bucketName = '';
    
    if (type === 'image') {
      allowedTypes = ALLOWED_IMAGE_TYPES;
      bucketName = 'media-images';
    } else if (type === 'audio') {
      allowedTypes = ALLOWED_AUDIO_TYPES;
      bucketName = 'media-audio';
    } else if (type === 'video') {
      allowedTypes = ALLOWED_VIDEO_TYPES;
      bucketName = 'media-videos';
    }

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: `Invalid file type. Allowed types: ${allowedTypes.join(', ')}` }, { status: 400 });
    }

    // Generate unique filename
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
    const bucketPath = path.join(process.cwd(), 'public', 'uploads', bucketName);
    const filePath = path.join(bucketPath, fileName);

    // Convert File to ArrayBuffer then to Uint8Array
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    await mkdir(bucketPath, { recursive: true });
    await writeFile(filePath, uint8Array);
    const publicUrl = `/uploads/${bucketName}/${fileName}`;

    return NextResponse.json({
      success: true,
      url: publicUrl,
      path: fileName,
      bucket: bucketName,
      type: file.type,
      size: file.size,
    });

  } catch (error: any) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: `Upload failed: ${error.message || 'Unknown error'}` }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  // Verify admin authentication for deletions
  const { requireAdminAuth } = await import('@/lib/auth-utils');
  const authCheck = await requireAdminAuth(request);
  if (!authCheck.authenticated) {
    return authCheck.response;
  }

  try {
    const { searchParams } = new URL(request.url);
    const fileParam = searchParams.get('path');
    const bucket = searchParams.get('bucket');

    if (!fileParam || !bucket) {
      return NextResponse.json({ error: 'Missing path or bucket parameter' }, { status: 400 });
    }
    if (fileParam.includes('..') || fileParam.includes('/') || fileParam.includes('\\')) {
      return NextResponse.json({ error: 'Invalid path parameter' }, { status: 400 });
    }

    const filePath = path.join(process.cwd(), 'public', 'uploads', bucket, fileParam);
    await unlink(filePath);

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Delete error:', error);
    return NextResponse.json({ error: `Delete failed: ${error.message || 'Unknown error'}` }, { status: 500 });
  }
}
