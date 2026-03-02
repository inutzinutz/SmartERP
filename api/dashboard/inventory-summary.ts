import type { VercelRequest, VercelResponse } from '@vercel/node';
import prisma from '../_lib/prisma';
import { getUserFromRequest } from '../_lib/auth';
import { cors } from '../_lib/cors';

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
      where: { product: { organizationId: orgId } },
      include: {
        product: { select: { name: true, code: true, costPrice: true, minStock: true } },
        warehouse: { select: { name: true } },
      },
    });

    let totalStockValue = 0;
    const lowStockItems: Array<{
      productId: string;
      productName: string;
      code: string;
      warehouseName: string;
      quantity: number;
      minStock: number;
    }> = [];

    for (const item of stockItems) {
      const qty = Number(item.quantity ?? 0);
      const cost = Number(item.product.costPrice ?? 0);
      totalStockValue += qty * cost;

      if (qty <= item.product.minStock) {
        lowStockItems.push({
          productId: item.productId,
          productName: item.product.name,
          code: item.product.code,
          warehouseName: item.warehouse.name,
          quantity: qty,
          minStock: item.product.minStock,
        });
      }
    }

    // Warehouse summary
    const warehouses = await prisma.warehouse.findMany({
      where: { organizationId: orgId },
      select: {
        id: true,
        name: true,
        address: true,
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
          const qty = Number(item.quantity ?? 0);
          const cost = Number(item.product.costPrice ?? 0);
          warehouseValue += qty * cost;
          totalQuantity += qty;
        }

        return {
          id: wh.id,
          name: wh.name,
          address: wh.address,
          isActive: wh.isActive,
          productCount: wh._count.stockItems,
          totalQuantity,
          stockValue: Math.round(warehouseValue * 100) / 100,
        };
      })
    );

    // Recent movements
    const recentMovements = await prisma.stockMovement.findMany({
      where: { product: { organizationId: orgId } },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        product: { select: { name: true, code: true } },
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
          code: m.product.code,
          warehouseName: m.warehouse.name,
          type: m.type,
          quantity: Number(m.quantity ?? 0),
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
