import type { VercelRequest, VercelResponse } from '@vercel/node';
import prisma from '../../lib/prisma';
import { getUserFromRequest } from '../../lib/auth';
import { cors } from '../../lib/cors';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;

  const auth = getUserFromRequest(req);
  if (!auth) return res.status(401).json({ message: 'Unauthorized' });

  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: auth.sub },
      select: { organizationId: true },
    });
    if (!user) return res.status(404).json({ message: 'User not found' });
    const orgId = user.organizationId;

    // Total stock value
    const stockItems = await prisma.stockItem.findMany({
      where: { organizationId: orgId },
      include: {
        product: { select: { name: true, sku: true, costPrice: true } },
        warehouse: { select: { name: true } },
      },
    });

    let totalStockValue = 0;
    const lowStockItems: Array<{
      productId: string;
      productName: string;
      sku: string;
      warehouseName: string;
      quantity: number;
      reorderLevel: number;
    }> = [];

    for (const item of stockItems) {
      const qty = item.quantity?.toNumber?.() ?? Number(item.quantity ?? 0);
      const cost = item.product.costPrice?.toNumber?.() ?? Number(item.product.costPrice ?? 0);
      totalStockValue += qty * cost;

      const reorderLevel = item.reorderLevel?.toNumber?.() ?? Number(item.reorderLevel ?? 0);
      if (qty <= reorderLevel) {
        lowStockItems.push({
          productId: item.productId,
          productName: item.product.name,
          sku: item.product.sku ?? '',
          warehouseName: item.warehouse.name,
          quantity: qty,
          reorderLevel,
        });
      }
    }

    // Warehouse summary
    const warehouses = await prisma.warehouse.findMany({
      where: { organizationId: orgId },
      select: {
        id: true,
        name: true,
        location: true,
        isActive: true,
        _count: { select: { stockItems: true } },
      },
    });

    const warehouseSummary = await Promise.all(
      warehouses.map(async (wh) => {
        const whStock = await prisma.stockItem.findMany({
          where: { warehouseId: wh.id },
          include: { product: { select: { costPrice: true } } },
        });

        let warehouseValue = 0;
        let totalQuantity = 0;
        for (const item of whStock) {
          const qty = item.quantity?.toNumber?.() ?? Number(item.quantity ?? 0);
          const cost = item.product.costPrice?.toNumber?.() ?? Number(item.product.costPrice ?? 0);
          warehouseValue += qty * cost;
          totalQuantity += qty;
        }

        return {
          id: wh.id,
          name: wh.name,
          location: wh.location,
          isActive: wh.isActive,
          productCount: wh._count.stockItems,
          totalQuantity,
          stockValue: Math.round(warehouseValue * 100) / 100,
        };
      })
    );

    // Recent movements
    const recentMovements = await prisma.stockMovement.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        product: { select: { name: true, sku: true } },
        warehouse: { select: { name: true } },
      },
    });

    return res.status(200).json({
      data: {
        totalStockValue: Math.round(totalStockValue * 100) / 100,
        totalProducts: new Set(stockItems.map((i) => i.productId)).size,
        lowStockAlerts: lowStockItems,
        lowStockCount: lowStockItems.length,
        warehouseSummary,
        recentMovements: recentMovements.map((m) => ({
          id: m.id,
          productName: m.product.name,
          sku: m.product.sku,
          warehouseName: m.warehouse.name,
          type: m.type,
          quantity: m.quantity?.toNumber?.() ?? Number(m.quantity ?? 0),
          reference: m.reference,
          createdAt: m.createdAt,
        })),
      },
    });
  } catch (error) {
    console.error('Inventory summary error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}
