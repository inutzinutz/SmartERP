import type { VercelRequest, VercelResponse } from '@vercel/node';
import prisma from '../../../lib/prisma';
import { getUserFromRequest } from '../../../lib/auth';
import { cors } from '../../../lib/cors';

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
  if (!id) return res.status(400).json({ message: 'Warehouse ID is required' });

  try {
    switch (req.method) {
      case 'GET': {
        const warehouse = await prisma.warehouse.findFirst({
          where: { id, organizationId: orgId },
          include: {
            stockItems: {
              include: {
                product: { select: { id: true, name: true, sku: true, unit: true, costPrice: true } },
              },
            },
            _count: { select: { stockItems: true, stockMovements: true } },
          },
        });

        if (!warehouse) {
          return res.status(404).json({ message: 'Warehouse not found' });
        }

        return res.status(200).json({ data: warehouse });
      }

      case 'PUT': {
        const existing = await prisma.warehouse.findFirst({
          where: { id, organizationId: orgId },
        });
        if (!existing) {
          return res.status(404).json({ message: 'Warehouse not found' });
        }

        const { name, location, description, isActive } = req.body;

        if (name && name !== existing.name) {
          const duplicate = await prisma.warehouse.findFirst({
            where: { organizationId: orgId, name, id: { not: id } },
          });
          if (duplicate) {
            return res.status(409).json({ message: 'A warehouse with this name already exists' });
          }
        }

        const warehouse = await prisma.warehouse.update({
          where: { id },
          data: {
            ...(name !== undefined && { name }),
            ...(location !== undefined && { location }),
            ...(description !== undefined && { description }),
            ...(isActive !== undefined && { isActive }),
          },
        });

        return res.status(200).json({ data: warehouse });
      }

      case 'DELETE': {
        const existing = await prisma.warehouse.findFirst({
          where: { id, organizationId: orgId },
        });
        if (!existing) {
          return res.status(404).json({ message: 'Warehouse not found' });
        }

        // Check for stock items
        const stockCount = await prisma.stockItem.count({
          where: { warehouseId: id, quantity: { gt: 0 } },
        });

        if (stockCount > 0) {
          return res.status(400).json({
            message: 'Cannot delete warehouse with existing stock. Transfer or remove stock first.',
          });
        }

        // Soft-delete
        const warehouse = await prisma.warehouse.update({
          where: { id },
          data: { isActive: false },
        });

        return res.status(200).json({ data: warehouse, message: 'Warehouse deactivated' });
      }

      default:
        return res.status(405).json({ message: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Warehouse [id] error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}
