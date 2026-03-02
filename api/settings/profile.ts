import type { VercelRequest, VercelResponse } from '@vercel/node';
import bcrypt from 'bcryptjs';
import prisma from '../_lib/prisma';
import { getUserFromRequest } from '../_lib/auth';
import { cors } from '../_lib/cors';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;

  const auth = getUserFromRequest(req);
  if (!auth) return res.status(401).json({ message: 'Unauthorized' });

  try {
    switch (req.method) {
      case 'PUT': {
        const { firstName, lastName, phone, password } = req.body;

        const updateData: any = {};
        if (firstName !== undefined) updateData.firstName = firstName;
        if (lastName !== undefined) updateData.lastName = lastName;
        if (phone !== undefined) updateData.phone = phone;

        if (password) {
          updateData.password = await bcrypt.hash(password, 12);
        }

        const updatedUser = await prisma.user.update({
          where: { id: auth.sub },
          data: updateData,
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            avatar: true,
            role: true,
            updatedAt: true,
          },
        });

        return res.status(200).json({ data: updatedUser });
      }

      default:
        return res.status(405).json({ message: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Settings profile error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}
