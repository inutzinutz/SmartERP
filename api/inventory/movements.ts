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
        const type = req.query.type as string;
        const warehouseId = req.query.warehouseId as string;
        const productId = req.query.productId as string;
        const sortBy = (req.query.sortBy as string) || 'createdAt';
        const sortOrder = (req.query.sortOrder as string) === 'asc' ? 'asc' : 'desc';

        const where: any = { product: { organizationId: orgId } };

        if (type) where.type = type;
        if (warehouseId) where.warehouseId = warehouseId;
        if (productId) where.productId = productId;

        if (search) {
          where.OR = [
            { reference: { contains: search, mode: 'insensitive' } },
            { notes: { contains: search, mode: 'insensitive' } },
            { product: { name: { contains: search, mode: 'insensitive' } } },
          ];
        }

        const [data, total] = await Promise.all([
          prisma.stockMovement.findMany({
            where,
            include: {
              product: { select: { id: true, name: true, code: true } },
              warehouse: { select: { id: true, name: true } },
            },
            orderBy: { [sortBy]: sortOrder },
            skip: (page - 1) * limit,
            take: limit,
          }),
          prisma.stockMovement.count({ where }),
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
        const { productId, warehouseId, type, quantity, reference, notes } = req.body;

        if (!productId || !warehouseId || !type || quantity === undefined) {
          return res.status(400).json({
            message: 'productId, warehouseId, type, and quantity are required',
          });
        }

        const validTypes = ['IN', 'OUT', 'TRANSFER', 'ADJUSTMENT', 'RETURN'];
        if (!validTypes.includes(type)) {
          return res.status(400).json({
            message: `Invalid movement type. Must be one of: ${validTypes.join(', ')}`,
          });
        }

        const qty = Number(quantity);
        if (isNaN(qty) || qty <= 0) {
          return res.status(400).json({ message: 'Quantity must be a positive number' });
        }

        // Verify product and warehouse belong to this org
        const [product, warehouse] = await Promise.all([
          prisma.product.findFirst({ where: { id: productId, organizationId: orgId } }),
          prisma.warehouse.findFirst({ where: { id: warehouseId, organizationId: orgId } }),
        ]);

        if (!product) return res.status(404).json({ message: 'Product not found' });
        if (!warehouse) return res.status(404).json({ message: 'Warehouse not found' });

        // Use transaction to create movement and update stock atomically
        const result = await prisma.$transaction(async (tx: any) => {
          // Find or create stock item
          let stockItem = await tx.stockItem.findFirst({
            where: { productId, warehouseId, product: { organizationId: orgId } },
          });

          if (!stockItem) {
            stockItem = await tx.stockItem.create({
              data: {
                productId,
                warehouseId,
                quantity: 0,
              },
            });
          }

          const currentQty = stockItem.quantity?.toNumber?.() ?? Number(stockItem.quantity ?? 0);

          // Calculate new quantity
          let newQuantity: number;
          if (type === 'IN' || type === 'RETURN') {
            newQuantity = currentQty + qty;
          } else if (type === 'OUT') {
            if (currentQty < qty) {
              throw new Error(`Insufficient stock. Available: ${currentQty}, Requested: ${qty}`);
            }
            newQuantity = currentQty - qty;
          } else if (type === 'ADJUSTMENT') {
            newQuantity = qty; // Adjustment sets to absolute value
          } else {
            // TRANSFER - reduce from source
            if (currentQty < qty) {
              throw new Error(`Insufficient stock. Available: ${currentQty}, Requested: ${qty}`);
            }
            newQuantity = currentQty - qty;
          }

          // Update stock level
          await tx.stockItem.update({
            where: { id: stockItem.id },
            data: { quantity: newQuantity },
          });

          // Create the movement record
          const movement = await tx.stockMovement.create({
            data: {
              productId,
              warehouseId,
              type,
              quantity: qty,
              reference: reference || null,
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
    console.error('Stock movements error:', error);
    if (error.message?.includes('Insufficient stock')) {
      return res.status(400).json({ message: error.message });
    }
    return res.status(500).json({ message: 'Internal server error' });
  }
}
