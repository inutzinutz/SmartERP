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
        const categoryId = req.query.categoryId as string;
        const sortBy = (req.query.sortBy as string) || 'createdAt';
        const sortOrder = (req.query.sortOrder as string) === 'asc' ? 'asc' : 'desc';
        const isActive = req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined;

        const where: any = { organizationId: orgId };

        if (search) {
          where.OR = [
            { name: { contains: search, mode: 'insensitive' } },
            { code: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
          ];
        }

        if (categoryId) {
          where.categoryId = categoryId;
        }

        if (isActive !== undefined) {
          where.isActive = isActive;
        }

        const [data, total] = await Promise.all([
          prisma.product.findMany({
            where,
            include: {
              category: { select: { id: true, name: true } },
            },
            orderBy: { [sortBy]: sortOrder },
            skip: (page - 1) * limit,
            take: limit,
          }),
          prisma.product.count({ where }),
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
        const { name, code, description, categoryId, costPrice, sellingPrice, unit, isActive } = req.body;

        if (!name) {
          return res.status(400).json({ message: 'Product name is required' });
        }

        if (code) {
          const existing = await prisma.product.findFirst({
            where: { organizationId: orgId, code },
          });
          if (existing) {
            return res.status(409).json({ message: 'A product with this code already exists' });
          }
        }

        const product = await prisma.product.create({
          data: {
            organization: { connect: { id: orgId } },
            name,
            code: code || 'PROD-' + Date.now(),
            description: description || null,
            categoryId: categoryId || null,
            costPrice: costPrice ?? 0,
            sellingPrice: sellingPrice ?? 0,
            unit: unit || 'pcs',
            isActive: isActive !== false,
          },
          include: {
            category: { select: { id: true, name: true } },
          },
        });

        return res.status(201).json({ data: product });
      }

      default:
        return res.status(405).json({ message: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Products error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}
