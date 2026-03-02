import type { VercelRequest, VercelResponse } from '@vercel/node';
import prisma from '../../lib/prisma';
import { getUserFromRequest } from '../../lib/auth';
import { cors } from '../../lib/cors';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;

  const auth = getUserFromRequest(req);
  if (!auth) return res.status(401).json({ message: 'Unauthorized' });

  const user = await prisma.user.findUnique({
    where: { id: auth.sub },
    select: { organizationId: true },
  });
  if (!user) return res.status(404).json({ message: 'User not found' });
  const orgId = user.organizationId;

  try {
    switch (req.method) {
      case 'GET': {
        const page = Math.max(1, parseInt(req.query.page as string) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
        const search = (req.query.search as string) || '';
        const sortBy = (req.query.sortBy as string) || 'name';
        const sortOrder = (req.query.sortOrder as string) === 'desc' ? 'desc' : 'asc';

        const where: any = { organizationId: orgId };

        if (search) {
          where.OR = [
            { name: { contains: search, mode: 'insensitive' } },
            { location: { contains: search, mode: 'insensitive' } },
          ];
        }

        const [data, total] = await Promise.all([
          prisma.warehouse.findMany({
            where,
            include: {
              _count: { select: { stockItems: true } },
            },
            orderBy: { [sortBy]: sortOrder },
            skip: (page - 1) * limit,
            take: limit,
          }),
          prisma.warehouse.count({ where }),
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
        const { name, location, description, isActive } = req.body;

        if (!name) {
          return res.status(400).json({ message: 'Warehouse name is required' });
        }

        const existing = await prisma.warehouse.findFirst({
          where: { organizationId: orgId, name },
        });
        if (existing) {
          return res.status(409).json({ message: 'A warehouse with this name already exists' });
        }

        const warehouse = await prisma.warehouse.create({
          data: {
            organizationId: orgId,
            name,
            location: location || null,
            description: description || null,
            isActive: isActive !== false,
          },
        });

        return res.status(201).json({ data: warehouse });
      }

      default:
        return res.status(405).json({ message: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Warehouses error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}
