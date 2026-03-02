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
  if (!id) return res.status(400).json({ message: 'Order ID is required' });

  try {
    switch (req.method) {
      case 'GET': {
        const order = await prisma.purchaseOrder.findFirst({
          where: { id, organizationId: orgId },
          include: {
            supplier: true,
            items: {
              include: {
                product: { select: { id: true, name: true, sku: true, unit: true } },
              },
            },
            createdByUser: { select: { id: true, name: true, email: true } },
          },
        });

        if (!order) {
          return res.status(404).json({ message: 'Purchase order not found' });
        }

        return res.status(200).json({ data: order });
      }

      case 'PUT': {
        const existing = await prisma.purchaseOrder.findFirst({
          where: { id, organizationId: orgId },
        });
        if (!existing) {
          return res.status(404).json({ message: 'Purchase order not found' });
        }

        if (existing.status !== 'DRAFT') {
          return res.status(400).json({ message: 'Only draft orders can be edited' });
        }

        const { supplierId, items, notes, expectedDate } = req.body;

        const order = await prisma.$transaction(async (tx) => {
          if (items && Array.isArray(items)) {
            await tx.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: id } });

            const productIds = items.map((i: any) => i.productId);
            const products = await tx.product.findMany({
              where: { id: { in: productIds }, organizationId: orgId },
            });
            const productMap = new Map(products.map((p) => [p.id, p]));

            if (products.length !== productIds.length) {
              throw new Error('One or more products not found');
            }

            const orderItems = items.map((item: any) => {
              const product = productMap.get(item.productId)!;
              const unitPrice = item.unitPrice ?? (product.costPrice?.toNumber?.() ?? Number(product.costPrice ?? 0));
              const quantity = Number(item.quantity);
              const totalPrice = quantity * unitPrice;

              return {
                purchaseOrderId: id,
                productId: item.productId,
                quantity,
                unitPrice,
                totalPrice,
              };
            });

            await tx.purchaseOrderItem.createMany({ data: orderItems });

            const totalAmount = orderItems.reduce((sum, item) => sum + item.totalPrice, 0);

            return tx.purchaseOrder.update({
              where: { id },
              data: {
                ...(supplierId && { supplierId }),
                ...(notes !== undefined && { notes }),
                ...(expectedDate !== undefined && { expectedDate: expectedDate ? new Date(expectedDate) : null }),
                totalAmount,
              },
              include: {
                supplier: { select: { id: true, name: true } },
                items: {
                  include: { product: { select: { id: true, name: true, sku: true } } },
                },
              },
            });
          }

          return tx.purchaseOrder.update({
            where: { id },
            data: {
              ...(supplierId && { supplierId }),
              ...(notes !== undefined && { notes }),
              ...(expectedDate !== undefined && { expectedDate: expectedDate ? new Date(expectedDate) : null }),
            },
            include: {
              supplier: { select: { id: true, name: true } },
              items: {
                include: { product: { select: { id: true, name: true, sku: true } } },
              },
            },
          });
        });

        return res.status(200).json({ data: order });
      }

      case 'PATCH': {
        const existing = await prisma.purchaseOrder.findFirst({
          where: { id, organizationId: orgId },
          include: { items: true },
        });
        if (!existing) {
          return res.status(404).json({ message: 'Purchase order not found' });
        }

        const { action, warehouseId } = req.body;

        if (action === 'confirm') {
          if (existing.status !== 'DRAFT') {
            return res.status(400).json({ message: 'Only draft orders can be confirmed' });
          }

          const order = await prisma.$transaction(async (tx) => {
            const updated = await tx.purchaseOrder.update({
              where: { id },
              data: { status: 'CONFIRMED' },
              include: {
                supplier: { select: { id: true, name: true } },
                items: {
                  include: { product: { select: { id: true, name: true, sku: true } } },
                },
              },
            });

            // Create payable
            await tx.payable.create({
              data: {
                organizationId: orgId,
                supplierId: existing.supplierId,
                purchaseOrderId: id,
                amount: existing.totalAmount,
                dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                status: 'PENDING',
              },
            });

            return updated;
          });

          return res.status(200).json({ data: order });
        }

        if (action === 'receive') {
          if (existing.status !== 'CONFIRMED') {
            return res.status(400).json({ message: 'Only confirmed orders can be received' });
          }

          if (!warehouseId) {
            return res.status(400).json({ message: 'warehouseId is required for receiving' });
          }

          const warehouse = await prisma.warehouse.findFirst({
            where: { id: warehouseId, organizationId: orgId },
          });
          if (!warehouse) {
            return res.status(404).json({ message: 'Warehouse not found' });
          }

          const order = await prisma.$transaction(async (tx) => {
            // Add stock for each item
            for (const item of existing.items) {
              const qty = item.quantity?.toNumber?.() ?? Number(item.quantity ?? 0);

              let stockItem = await tx.stockItem.findFirst({
                where: { productId: item.productId, warehouseId, organizationId: orgId },
              });

              if (stockItem) {
                const currentQty = stockItem.quantity?.toNumber?.() ?? Number(stockItem.quantity ?? 0);
                await tx.stockItem.update({
                  where: { id: stockItem.id },
                  data: { quantity: currentQty + qty },
                });
              } else {
                await tx.stockItem.create({
                  data: {
                    organizationId: orgId,
                    productId: item.productId,
                    warehouseId,
                    quantity: qty,
                    reorderLevel: 0,
                  },
                });
              }

              // Create stock movement
              await tx.stockMovement.create({
                data: {
                  organizationId: orgId,
                  productId: item.productId,
                  warehouseId,
                  type: 'IN',
                  quantity: qty,
                  reference: `PO: ${existing.orderNumber}`,
                  createdBy: auth.sub,
                },
              });
            }

            return tx.purchaseOrder.update({
              where: { id },
              data: { status: 'RECEIVED' },
              include: {
                supplier: { select: { id: true, name: true } },
                items: {
                  include: { product: { select: { id: true, name: true, sku: true } } },
                },
              },
            });
          });

          return res.status(200).json({ data: order });
        }

        if (action === 'cancel') {
          if (!['DRAFT', 'CONFIRMED'].includes(existing.status)) {
            return res.status(400).json({ message: 'This order cannot be cancelled' });
          }

          const order = await prisma.purchaseOrder.update({
            where: { id },
            data: { status: 'CANCELLED' },
            include: {
              supplier: { select: { id: true, name: true } },
              items: {
                include: { product: { select: { id: true, name: true, sku: true } } },
              },
            },
          });

          return res.status(200).json({ data: order });
        }

        return res.status(400).json({ message: 'Invalid action. Use "confirm", "receive", or "cancel"' });
      }

      default:
        return res.status(405).json({ message: 'Method not allowed' });
    }
  } catch (error: any) {
    console.error('Purchase order [id] error:', error);
    if (error.message?.includes('not found')) {
      return res.status(400).json({ message: error.message });
    }
    return res.status(500).json({ message: 'Internal server error' });
  }
}
