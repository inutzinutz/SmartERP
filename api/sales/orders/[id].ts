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
  if (!id) return res.status(400).json({ message: 'Order ID is required' });

  try {
    switch (req.method) {
      case 'GET': {
        const order = await prisma.salesOrder.findFirst({
          where: { id, customer: { organizationId: orgId } },
          include: {
            customer: true,
            items: {
              include: {
                product: { select: { id: true, name: true, code: true, unit: true } },
              },
            },
            user: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
        });

        if (!order) {
          return res.status(404).json({ message: 'Sales order not found' });
        }

        return res.status(200).json({ data: order });
      }

      case 'PUT': {
        const existing = await prisma.salesOrder.findFirst({
          where: { id, customer: { organizationId: orgId } },
        });
        if (!existing) {
          return res.status(404).json({ message: 'Sales order not found' });
        }

        if (existing.status !== 'DRAFT') {
          return res.status(400).json({ message: 'Only draft orders can be edited' });
        }

        const { customerId, items, notes, orderDate } = req.body;

        const order = await prisma.$transaction(async (tx: any) => {
          // If items are provided, replace them
          if (items && Array.isArray(items)) {
            // Delete existing items
            await tx.salesOrderItem.deleteMany({ where: { salesOrderId: id } });

            // Verify products
            const productIds = items.map((i: any) => i.productId);
            const products = await tx.product.findMany({
              where: { id: { in: productIds }, organizationId: orgId },
            });
            const productMap = new Map(products.map((p: any) => [p.id, p]));

            if (products.length !== productIds.length) {
              throw new Error('One or more products not found');
            }

            const orderItems = items.map((item: any) => {
              const product = productMap.get(item.productId)!;
              const unitPrice = item.unitPrice ?? ((product as any).sellingPrice?.toNumber?.() ?? Number((product as any).sellingPrice ?? 0));
              const quantity = Number(item.quantity);
              const discount = Number(item.discount ?? 0);
              const totalAmount = quantity * unitPrice - discount;

              return {
                salesOrderId: id,
                productId: item.productId,
                quantity,
                unitPrice,
                discount,
                totalAmount,
              };
            });

            await tx.salesOrderItem.createMany({ data: orderItems });

            const totalOrderAmount = orderItems.reduce((sum: number, item: any) => sum + item.totalAmount, 0);

            return tx.salesOrder.update({
              where: { id },
              data: {
                ...(customerId && { customerId }),
                ...(notes !== undefined && { notes }),
                ...(orderDate && { orderDate: new Date(orderDate) }),
                totalAmount: totalOrderAmount,
              },
              include: {
                customer: { select: { id: true, name: true } },
                items: {
                  include: { product: { select: { id: true, name: true, code: true } } },
                },
              },
            });
          }

          // Update only order-level fields
          return tx.salesOrder.update({
            where: { id },
            data: {
              ...(customerId && { customerId }),
              ...(notes !== undefined && { notes }),
              ...(orderDate && { orderDate: new Date(orderDate) }),
            },
            include: {
              customer: { select: { id: true, name: true } },
              items: {
                include: { product: { select: { id: true, name: true, code: true } } },
              },
            },
          });
        });

        return res.status(200).json({ data: order });
      }

      case 'PATCH': {
        const existing = await prisma.salesOrder.findFirst({
          where: { id, customer: { organizationId: orgId } },
          include: { items: true },
        });
        if (!existing) {
          return res.status(404).json({ message: 'Sales order not found' });
        }

        const { action } = req.body;

        if (action === 'confirm') {
          if (existing.status !== 'DRAFT') {
            return res.status(400).json({ message: 'Only draft orders can be confirmed' });
          }

          const order = await prisma.$transaction(async (tx: any) => {
            // Update order status
            const updated = await tx.salesOrder.update({
              where: { id },
              data: { status: 'CONFIRMED' },
              include: {
                customer: { select: { id: true, name: true } },
                items: {
                  include: { product: { select: { id: true, name: true, code: true } } },
                },
              },
            });

            // Create receivable
            await tx.receivable.create({
              data: {
                customerId: existing.customerId,
                salesOrderId: id,
                amount: existing.totalAmount,
                dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
                status: 'PENDING',
              },
            });

            return updated;
          });

          return res.status(200).json({ data: order });
        }

        if (action === 'cancel') {
          if (!['DRAFT', 'CONFIRMED'].includes(existing.status)) {
            return res.status(400).json({ message: 'This order cannot be cancelled' });
          }

          const order = await prisma.salesOrder.update({
            where: { id },
            data: { status: 'CANCELLED' },
            include: {
              customer: { select: { id: true, name: true } },
              items: {
                include: { product: { select: { id: true, name: true, code: true } } },
              },
            },
          });

          return res.status(200).json({ data: order });
        }

        return res.status(400).json({ message: 'Invalid action. Use "confirm" or "cancel"' });
      }

      default:
        return res.status(405).json({ message: 'Method not allowed' });
    }
  } catch (error: any) {
    console.error('Sales order [id] error:', error);
    if (error.message?.includes('not found')) {
      return res.status(400).json({ message: error.message });
    }
    return res.status(500).json({ message: 'Internal server error' });
  }
}
