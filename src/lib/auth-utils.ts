
import { NextRequest } from 'next/server';
import { verifyAdminSession } from './admin-auth';

export async function verifyAdminAuth(request: NextRequest): Promise<{
  isValid: boolean;
  user?: any;
  error?: string;
}> {
  try {
    const session = await verifyAdminSession(request);
    if (!session.isValid) {
      return { isValid: false, error: 'Invalid or expired session' };
    }
    return { isValid: true, user: { email: session.email } };
  } catch (error: any) {
    console.error('Auth verification error:', error);
    return { isValid: false, error: error.message || 'Authentication failed' };
  }
}

export async function requireAdminAuth(request: NextRequest) {
  const authResult = await verifyAdminAuth(request);
  
  if (!authResult.isValid) {
    return {
      authenticated: false,
      response: new Response(
        JSON.stringify({ error: 'Unauthorized', details: authResult.error }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    };
  }
  
  return { authenticated: true, user: authResult.user };
}
