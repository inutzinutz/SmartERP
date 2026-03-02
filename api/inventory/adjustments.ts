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
      case 'POST': {
        const { productId, warehouseId, quantity, reason, notes } = req.body;

        if (!productId || !warehouseId || quantity === undefined) {
          return res.status(400).json({
            message: 'productId, warehouseId, and quantity are required',
          });
        }

        const qty = Number(quantity);
        if (isNaN(qty) || qty === 0) {
          return res.status(400).json({ message: 'Quantity must be a non-zero number' });
        }

        // Verify product and warehouse belong to this org
        const [product, warehouse] = await Promise.all([
          prisma.product.findFirst({ where: { id: productId, organizationId: orgId } }),
          prisma.warehouse.findFirst({ where: { id: warehouseId, organizationId: orgId } }),
        ]);

        if (!product) return res.status(404).json({ message: 'Product not found' });
        if (!warehouse) return res.status(404).json({ message: 'Warehouse not found' });

        const result = await prisma.$transaction(async (tx: any) => {
          // Find or create stock item
          let stockItem = await tx.stockItem.findUnique({
            where: { productId_warehouseId: { productId, warehouseId } },
          });

          if (!stockItem) {
            stockItem = await tx.stockItem.create({
              data: {
                product: { connect: { id: productId } },
                warehouse: { connect: { id: warehouseId } },
                quantity: 0,
              },
            });
          }

          const currentQty = stockItem.quantity?.toNumber?.() ?? Number(stockItem.quantity ?? 0);
          const newQuantity = currentQty + qty;

          if (newQuantity < 0) {
            throw new Error(
              `Adjustment would result in negative stock. Current: ${currentQty}, Adjustment: ${qty}`
            );
          }

          // Update stock level
          await tx.stockItem.update({
            where: { id: stockItem.id },
            data: { quantity: newQuantity },
          });

          // Create movement record
          const movement = await tx.stockMovement.create({
            data: {
              product: { connect: { id: productId } },
              warehouse: { connect: { id: warehouseId } },
              type: 'ADJUSTMENT',
              quantity: qty,
              reference: reason || null,
              notes: notes || null,
            },
            include: {
              product: { select: { id: true, name: true, code: true } },
              warehouse: { select: { id: true, name: true } },
            },
          });

          return { movement, newQuantity };
        });

        return res.status(201).json({
          data: result.movement,
          stockLevel: result.newQuantity,
        });
      }

      default:
        return res.status(405).json({ message: 'Method not allowed' });
    }
  } catch (error: any) {
    console.error('Inventory adjustments error:', error);
    if (error.message?.includes('negative stock')) {
      return res.status(400).json({ message: error.message });
    }
    return res.status(500).json({ message: 'Internal server error' });
  }
}
