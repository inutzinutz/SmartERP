import type { VercelRequest, VercelResponse } from '@vercel/node';
import prisma from '../../_lib/prisma';
import { getUserFromRequest } from '../../_lib/auth';
import { cors } from '../../_lib/cors';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;

  const auth = getUserFromRequest(req);
  if (!auth) return res.status(401).json({ message: 'Unauthorized' });

  const user = await prisma.user.findUnique({
    where: { id: auth.sub },
    select: { organizationId: true, role: true },
  });
  if (!user) return res.status(404).json({ message: 'User not found' });
  const orgId = user.organizationId;

  const id = req.query.id as string;
  if (!id) return res.status(400).json({ message: 'User ID is required' });

  try {
    switch (req.method) {
      case 'PATCH': {
        // Only admins and super_admins can toggle user status
        if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
          return res.status(403).json({ message: 'Only admins can change user status' });
        }

        // Prevent toggling own status
        if (id === auth.sub) {
          return res.status(400).json({ message: 'You cannot change your own status' });
        }

        const targetUser = await prisma.user.findFirst({
          where: { id, organizationId: orgId },
          select: { id: true, isActive: true },
        });

        if (!targetUser) {
          return res.status(404).json({ message: 'User not found' });
        }

        const updatedUser = await prisma.user.update({
          where: { id },
          data: { isActive: !targetUser.isActive },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
          },
        });

        return res.status(200).json({ data: updatedUser });
      }

      default:
        return res.status(405).json({ message: 'Method not allowed' });
    }
  } catch (error) {
    console.error('User status error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}
