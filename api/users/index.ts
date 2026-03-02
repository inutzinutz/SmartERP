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

  try {
    switch (req.method) {
      case 'GET': {
        const page = Math.max(1, parseInt(req.query.page as string) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
        const search = (req.query.search as string) || '';
        const role = req.query.role as string;
        const isActive = req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined;
        const sortBy = (req.query.sortBy as string) || 'firstName';
        const sortOrder = (req.query.sortOrder as string) === 'desc' ? 'desc' : 'asc';

        const where: any = { organizationId: orgId };

        if (role) where.role = role;
        if (isActive !== undefined) where.isActive = isActive;

        if (search) {
          where.OR = [
            { firstName: { contains: search, mode: 'insensitive' } },
            { lastName: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
          ];
        }

        const [data, total] = await Promise.all([
          prisma.user.findMany({
            where,
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
            orderBy: { [sortBy]: sortOrder },
            skip: (page - 1) * limit,
            take: limit,
          }),
          prisma.user.count({ where }),
        ]);

        return res.status(200).json({
          data,
          meta: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
          },
        });
      }

      case 'POST': {
        // Only admins can create users
        if (user.role !== 'ADMIN') {
          return res.status(403).json({ message: 'Only admins can create users' });
        }

        const { firstName, lastName, email, password, role, isActive } = req.body;

        if (!firstName || !lastName || !email) {
          return res.status(400).json({ message: 'firstName, lastName, and email are required' });
        }

        const validRoles = ['ADMIN', 'MANAGER', 'ACCOUNTANT', 'WAREHOUSE_MANAGER', 'SALES_REP', 'PURCHASER', 'CASHIER', 'VIEWER'];
        if (role && !validRoles.includes(role)) {
          return res.status(400).json({
            message: `Invalid role. Must be one of: ${validRoles.join(', ')}`,
          });
        }

        const existing = await prisma.user.findFirst({
          where: { email },
        });
        if (existing) {
          return res.status(409).json({ message: 'A user with this email already exists' });
        }

        // In production, password should be hashed. This assumes the auth layer handles it.
        const newUser = await prisma.user.create({
          data: {
            organization: { connect: { id: orgId } },
            firstName,
            lastName,
            email,
            password: password || '', // auth layer should hash this
            role: role || 'STAFF',
            isActive: isActive !== false,
          },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
            isActive: true,
            createdAt: true,
          },
        });

        return res.status(201).json({ data: newUser });
      }

      default:
        return res.status(405).json({ message: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Users error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}
