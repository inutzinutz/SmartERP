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
  if (!id) return res.status(400).json({ message: 'Supplier ID is required' });

  try {
    switch (req.method) {
      case 'GET': {
        const supplier = await prisma.supplier.findFirst({
          where: { id, organizationId: orgId },
          include: {
            purchaseOrders: {
              orderBy: { createdAt: 'desc' },
              take: 10,
              select: {
                id: true,
                orderNumber: true,
                status: true,
                totalAmount: true,
                createdAt: true,
              },
            },
            payables: {
              where: { status: { in: ['PENDING', 'OVERDUE'] } },
              select: {
                id: true,
                amount: true,
                dueDate: true,
                status: true,
              },
            },
            _count: { select: { purchaseOrders: true, payables: true } },
          },
        });

        if (!supplier) {
          return res.status(404).json({ message: 'Supplier not found' });
        }

        return res.status(200).json({ data: supplier });
      }

      case 'PUT': {
        const existing = await prisma.supplier.findFirst({
          where: { id, organizationId: orgId },
        });
        if (!existing) {
          return res.status(404).json({ message: 'Supplier not found' });
        }

        const { name, email, phone, address, city, country, taxId, code, contactPerson, notes } = req.body;

        if (email && email !== existing.email) {
          const duplicate = await prisma.supplier.findFirst({
            where: { organizationId: orgId, email, id: { not: id } },
          });
          if (duplicate) {
            return res.status(409).json({ message: 'A supplier with this email already exists' });
          }
        }

        const supplier = await prisma.supplier.update({
          where: { id },
          data: {
            ...(name !== undefined && { name }),
            ...(email !== undefined && { email }),
            ...(phone !== undefined && { phone }),
            ...(address !== undefined && { address }),
            ...(city !== undefined && { city }),
            ...(country !== undefined && { country }),
            ...(taxId !== undefined && { taxId }),
            ...(code !== undefined && { code }),
            ...(contactPerson !== undefined && { contactPerson }),
            ...(notes !== undefined && { notes }),
          },
        });

        return res.status(200).json({ data: supplier });
      }

      case 'DELETE': {
        const existing = await prisma.supplier.findFirst({
          where: { id, organizationId: orgId },
        });
        if (!existing) {
          return res.status(404).json({ message: 'Supplier not found' });
        }

        const activeOrders = await prisma.purchaseOrder.count({
          where: { supplierId: id, status: { in: ['DRAFT', 'CONFIRMED'] } },
        });

        if (activeOrders > 0) {
          return res.status(400).json({
            message: 'Cannot delete supplier with active orders',
          });
        }

        await prisma.supplier.delete({ where: { id } });

        return res.status(200).json({ message: 'Supplier deleted' });
      }

      default:
        return res.status(405).json({ message: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Supplier [id] error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}
