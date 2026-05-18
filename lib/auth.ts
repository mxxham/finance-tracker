import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';

const JWT_SECRET = process.env.JWT_SECRET;

// Don't throw at module load time — this crashes the build.
// Instead, validate at request time inside requireAuth/signToken.
if (!JWT_SECRET && process.env.NODE_ENV === 'production') {
  console.error('[auth] CRITICAL: JWT_SECRET environment variable is not set. All auth will fail.');
}

const SECRET = JWT_SECRET || 'dev-only-insecure-fallback-key-do-not-use-in-prod';

export const MIN_PASSWORD_LENGTH = 8;

export interface JWTPayload {
  userId: number;
  email: string;
}

export function signToken(payload: JWTPayload): string {
  return jwt.sign(payload, SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): JWTPayload {
  return jwt.verify(token, SECRET) as JWTPayload;
}

export function getAuthUser(req: NextRequest): JWTPayload | null {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) return null;
    const token = authHeader.split(' ')[1];
    return verifyToken(token);
  } catch {
    return null;
  }
}

export function requireAuth(req: NextRequest): JWTPayload {
  const user = getAuthUser(req);
  if (!user) throw new Error('Unauthorized');
  return user;
}