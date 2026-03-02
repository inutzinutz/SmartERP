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
        const product = await prisma.product.findFirst({
          where: { id, organizationId: orgId },
          include: {
            category: { select: { id: true, name: true } },
            stockItems: {
              include: {
                warehouse: { select: { id: true, name: true, location: true } },
              },
            },
          },
        });

        if (!product) {
          return res.status(404).json({ message: 'Product not found' });
        }

        return res.status(200).json({ data: product });
      }

      case 'PUT': {
        const existing = await prisma.product.findFirst({
          where: { id, organizationId: orgId },
        });
        if (!existing) {
          return res.status(404).json({ message: 'Product not found' });
        }

        const { name, sku, description, categoryId, costPrice, sellingPrice, unit, isActive } = req.body;

        if (sku && sku !== existing.sku) {
          const duplicate = await prisma.product.findFirst({
            where: { organizationId: orgId, sku, id: { not: id } },
          });
          if (duplicate) {
            return res.status(409).json({ message: 'A product with this SKU already exists' });
          }
        }

        const product = await prisma.product.update({
          where: { id },
          data: {
            ...(name !== undefined && { name }),
            ...(sku !== undefined && { sku }),
            ...(description !== undefined && { description }),
            ...(categoryId !== undefined && { categoryId: categoryId || null }),
            ...(costPrice !== undefined && { costPrice }),
            ...(sellingPrice !== undefined && { sellingPrice }),
            ...(unit !== undefined && { unit }),
            ...(isActive !== undefined && { isActive }),
          },
          include: {
            category: { select: { id: true, name: true } },
          },
        });

        return res.status(200).json({ data: product });
      }

      case 'DELETE': {
        const existing = await prisma.product.findFirst({
          where: { id, organizationId: orgId },
        });
        if (!existing) {
          return res.status(404).json({ message: 'Product not found' });
        }

        // Soft-delete: deactivate instead of removing
        const product = await prisma.product.update({
          where: { id },
          data: { isActive: false },
        });

        return res.status(200).json({ data: product, message: 'Product deactivated' });
      }

      default:
        return res.status(405).json({ message: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Product [id] error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}
