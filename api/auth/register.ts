import type { VercelRequest, VercelResponse } from '@vercel/node';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma';
import { signToken } from '../lib/auth';
import { cors } from '../lib/cors';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

  try {
    const { email, password, firstName, lastName, phone, organizationName, currency } = req.body;

    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({ message: 'Email, password, firstName, and lastName are required' });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ message: 'Email already registered' });

    const org = await prisma.organization.create({
      data: {
        name: organizationName || `${firstName}'s Organization`,
        code: `ORG-${Date.now()}`,
        currency: currency || 'THB',
      },
    });

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName,
        phone,
        role: 'ADMIN',
        organizationId: org.id,
      },
      select: {
        id: true, email: true, firstName: true, lastName: true, role: true,
        organization: { select: { id: true, name: true, code: true } },
      },
    });

    const accessToken = signToken(user.id, user.email, user.role);
    return res.status(201).json({ user, token: { accessToken, expiresIn: '7d' } });
  } catch (error: any) {
    console.error('Register error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}
