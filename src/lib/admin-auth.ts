import { NextRequest, NextResponse } from 'next/server';
import { createHmac, scryptSync, timingSafeEqual } from 'crypto';

const SESSION_COOKIE = 'admin_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 8; // 8 hours

const adminEmail = process.env.ADMIN_EMAIL;
const adminPassword = process.env.ADMIN_PASSWORD;
const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;
const adminPasswordSalt = process.env.ADMIN_PASSWORD_SALT;
const sessionSecret = process.env.ADMIN_SESSION_SECRET;

const hashPassword = (password: string, salt: string) => {
  return scryptSync(password, salt, 64).toString('hex');
};

const verifyPassword = (password: string) => {
  if (adminPasswordHash && adminPasswordSalt) {
    const hashed = hashPassword(password, adminPasswordSalt);
    const hashBuffer = Buffer.from(adminPasswordHash, 'hex');
    const compareBuffer = Buffer.from(hashed, 'hex');
    if (hashBuffer.length !== compareBuffer.length) {
      return false;
    }
    return timingSafeEqual(hashBuffer, compareBuffer);
  }

  if (adminPassword) {
    return timingSafeEqual(Buffer.from(adminPassword), Buffer.from(password));
  }

  return false;
};

const signSession = (payload: string) => {
  if (!sessionSecret) {
    throw new Error('Missing ADMIN_SESSION_SECRET');
  }
  return createHmac('sha256', sessionSecret).update(payload).digest('hex');
};

export const createAdminSession = (email: string) => {
  const exp = Date.now() + SESSION_TTL_MS;
  const payload = JSON.stringify({ email, exp });
  const signature = signSession(payload);
  return Buffer.from(`${payload}.${signature}`).toString('base64url');
};

export const verifyAdminSession = async (request: NextRequest) => {
  const cookie = request.cookies.get(SESSION_COOKIE)?.value;
  if (!cookie || !sessionSecret) {
    return { isValid: false };
  }

  try {
    const decoded = Buffer.from(cookie, 'base64url').toString('utf-8');
    const [payload, signature] = decoded.split('.');
    if (!payload || !signature) return { isValid: false };
    const expected = signSession(payload);
    if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
      return { isValid: false };
    }
    const parsed = JSON.parse(payload) as { email: string; exp: number };
    if (parsed.exp < Date.now()) {
      return { isValid: false };
    }
    return { isValid: true, email: parsed.email };
  } catch {
    return { isValid: false };
  }
};

export const requireAdminAuth = async (request: NextRequest) => {
  const session = await verifyAdminSession(request);
  if (!session.isValid) {
    return {
      authenticated: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    };
  }
  return { authenticated: true };
};

export const verifyAdminCredentials = (email: string, password: string) => {
  if (!adminEmail || !sessionSecret) {
    return false;
  }
  if (email.toLowerCase() !== adminEmail.toLowerCase()) {
    return false;
  }
  return verifyPassword(password);
};
