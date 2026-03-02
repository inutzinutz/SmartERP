import type { VercelRequest, VercelResponse } from '@vercel/node';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma';
import { signToken } from '../lib/auth';
import { cors } from '../lib/cors';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email and password required' });

    const user = await prisma.user.findUnique({
      where: { email },
      include: { organization: { select: { id: true, name: true, code: true, logo: true } } },
    });

    if (!user || !user.isActive) return res.status(401).json({ message: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ message: 'Invalid credentials' });

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    const accessToken = signToken(user.id, user.email, user.role);
    const { password: _, ...userWithoutPassword } = user;

    return res.status(200).json({
      user: userWithoutPassword,
      token: { accessToken, expiresIn: '7d' },
    });
  } catch (error: any) {
    console.error('Login error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}
