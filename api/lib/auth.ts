import jwt from 'jsonwebtoken';
import type { VercelRequest } from '@vercel/node';

const JWT_SECRET = process.env.JWT_SECRET || 'smarterp-supabase-jwt-secret-2024';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

export function signToken(userId: string, email: string, role: string) {
  return jwt.sign({ sub: userId, email, role }, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}

export function getUserFromRequest(req: VercelRequest): JwtPayload | null {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  return verifyToken(token);
}
