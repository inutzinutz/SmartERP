import type { VercelRequest, VercelResponse } from '@vercel/node';
import prisma from '../_lib/prisma';
import { getUserFromRequest } from '../_lib/auth';
import { cors } from '../_lib/cors';

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
      case 'GET': {
        const targetUser = await prisma.user.findFirst({
          where: { id, organizationId: orgId },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
            lastLoginAt: true,
          },
        });

        if (!targetUser) {
          return res.status(404).json({ message: 'User not found' });
        }

        return res.status(200).json({ data: targetUser });
      }

      case 'PUT': {
        // Users can update their own profile, admins can update anyone
        if (id !== auth.sub && user.role !== 'ADMIN') {
          return res.status(403).json({ message: 'Forbidden' });
        }

        const existing = await prisma.user.findFirst({
          where: { id, organizationId: orgId },
        });
        if (!existing) {
          return res.status(404).json({ message: 'User not found' });
        }

        const { firstName, lastName, email, role, isActive } = req.body;

        if (email && email !== existing.email) {
          const duplicate = await prisma.user.findFirst({
            where: { email, id: { not: id } },
          });
          if (duplicate) {
            return res.status(409).json({ message: 'A user with this email already exists' });
          }
        }

        // Non-admins cannot change their own role or active status
        const updateData: any = {};
        if (firstName !== undefined) updateData.firstName = firstName;
        if (lastName !== undefined) updateData.lastName = lastName;
        if (email !== undefined) updateData.email = email;

        if (user.role === 'ADMIN') {
          if (role !== undefined) updateData.role = role;
          if (isActive !== undefined) updateData.isActive = isActive;
        }

        const updatedUser = await prisma.user.update({
          where: { id },
          data: updateData,
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

      case 'DELETE': {
        if (user.role !== 'ADMIN') {
          return res.status(403).json({ message: 'Only admins can delete users' });
        }

        if (id === auth.sub) {
          return res.status(400).json({ message: 'You cannot delete your own account' });
        }

        const existing = await prisma.user.findFirst({
          where: { id, organizationId: orgId },
        });
        if (!existing) {
          return res.status(404).json({ message: 'User not found' });
        }

        // Soft-delete: deactivate instead of removing
        const updatedUser = await prisma.user.update({
          where: { id },
          data: { isActive: false },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
            isActive: true,
          },
        });

        return res.status(200).json({ data: updatedUser, message: 'User deactivated' });
      }

      default:
        return res.status(405).json({ message: 'Method not allowed' });
    }
  } catch (error) {
    console.error('User [id] error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}
