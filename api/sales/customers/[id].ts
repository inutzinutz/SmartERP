import type { VercelRequest, VercelResponse } from '@vercel/node';
import prisma from '../../../_lib/prisma';
import { getUserFromRequest } from '../../../_lib/auth';
import { cors } from '../../../_lib/cors';

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
  if (!id) return res.status(400).json({ message: 'Customer ID is required' });

  try {
    switch (req.method) {
      case 'GET': {
        const customer = await prisma.customer.findFirst({
          where: { id, organizationId: orgId },
          include: {
            salesOrders: {
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
            receivables: {
              where: { status: { in: ['PENDING', 'OVERDUE'] } },
              select: {
                id: true,
                amount: true,
                dueDate: true,
                status: true,
              },
            },
            _count: { select: { salesOrders: true, receivables: true } },
          },
        });

        if (!customer) {
          return res.status(404).json({ message: 'Customer not found' });
        }

        return res.status(200).json({ data: customer });
      }

      case 'PUT': {
        const existing = await prisma.customer.findFirst({
          where: { id, organizationId: orgId },
        });
        if (!existing) {
          return res.status(404).json({ message: 'Customer not found' });
        }

        const { name, email, phone, address, city, country, taxId, code, tier, creditLimit, notes } = req.body;

        if (email && email !== existing.email) {
          const duplicate = await prisma.customer.findFirst({
            where: { organizationId: orgId, email, id: { not: id } },
          });
          if (duplicate) {
            return res.status(409).json({ message: 'A customer with this email already exists' });
          }
        }

        const customer = await prisma.customer.update({
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
            ...(tier !== undefined && { tier }),
            ...(creditLimit !== undefined && { creditLimit }),
            ...(notes !== undefined && { notes }),
          },
        });

        return res.status(200).json({ data: customer });
      }

      case 'DELETE': {
        const existing = await prisma.customer.findFirst({
          where: { id, organizationId: orgId },
        });
        if (!existing) {
          return res.status(404).json({ message: 'Customer not found' });
        }

        // Check for active orders
        const activeOrders = await prisma.salesOrder.count({
          where: { customerId: id, status: { in: ['DRAFT', 'CONFIRMED'] } },
        });

        if (activeOrders > 0) {
          return res.status(400).json({
            message: 'Cannot delete customer with active orders',
          });
        }

        await prisma.customer.delete({ where: { id } });

        return res.status(200).json({ message: 'Customer deleted' });
      }

      default:
        return res.status(405).json({ message: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Customer [id] error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}
