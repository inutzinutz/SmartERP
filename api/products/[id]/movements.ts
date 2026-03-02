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
    select: { organizationId: true },
  });
  if (!user) return res.status(404).json({ message: 'User not found' });
  const orgId = user.organizationId;

  const id = req.query.id as string;
  if (!id) return res.status(400).json({ message: 'Product ID is required' });

  try {
    switch (req.method) {
      case 'GET': {
        // Verify product belongs to this org
        const product = await prisma.product.findFirst({
          where: { id, organizationId: orgId },
          select: { id: true, name: true, code: true },
        });

        if (!product) {
          return res.status(404).json({ message: 'Product not found' });
        }

        const page = Math.max(1, parseInt(req.query.page as string) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));

        const where = {
          productId: id,
          product: { organizationId: orgId },
        };

        const [data, total] = await Promise.all([
          prisma.stockMovement.findMany({
            where,
            include: {
              warehouse: { select: { id: true, name: true } },
            },
            orderBy: { createdAt: 'desc' },
            skip: (page - 1) * limit,
            take: limit,
          }),
          prisma.stockMovement.count({ where }),
        ]);

        return res.status(200).json({
          data,
          product,
          meta: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
          },
        });
      }

      default:
        return res.status(405).json({ message: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Product movements error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}
