import type { VercelRequest, VercelResponse } from '@vercel/node';
import prisma from '../../_lib/prisma';
import { getUserFromRequest } from '../../_lib/auth';
import { cors } from '../../_lib/cors';

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

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const search = (req.query.search as string) || '';
    const warehouseId = req.query.warehouseId as string;
    const lowStockOnly = req.query.lowStock === 'true';
    const sortBy = (req.query.sortBy as string) || 'product';
    const sortOrder = (req.query.sortOrder as string) === 'asc' ? 'asc' : 'desc';

    const where: any = { organizationId: orgId };

    if (warehouseId) {
      where.warehouseId = warehouseId;
    }

    if (search) {
      where.product = {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { sku: { contains: search, mode: 'insensitive' } },
        ],
      };
    }

    // For low stock filtering we need a raw approach or post-filter
    // We'll use a simplified approach
    const orderByMap: Record<string, any> = {
      product: { product: { name: sortOrder } },
      quantity: { quantity: sortOrder },
      warehouse: { warehouse: { name: sortOrder } },
      createdAt: { createdAt: sortOrder },
    };

    const [allItems, total] = await Promise.all([
      prisma.stockItem.findMany({
        where,
        include: {
          product: { select: { id: true, name: true, sku: true, unit: true, costPrice: true } },
          warehouse: { select: { id: true, name: true, location: true } },
        },
        orderBy: orderByMap[sortBy] || { createdAt: 'desc' },
        ...(lowStockOnly ? {} : { skip: (page - 1) * limit, take: limit }),
      }),
      prisma.stockItem.count({ where }),
    ]);

    let items = allItems;

    if (lowStockOnly) {
      items = allItems.filter((item) => {
        const qty = item.quantity?.toNumber?.() ?? Number(item.quantity ?? 0);
        const reorder = item.reorderLevel?.toNumber?.() ?? Number(item.reorderLevel ?? 0);
        return qty <= reorder;
      });
      const filtered = items.slice((page - 1) * limit, page * limit);
      return res.status(200).json({
        data: filtered.map((item) => ({
          id: item.id,
          product: item.product,
          warehouse: item.warehouse,
          quantity: item.quantity?.toNumber?.() ?? Number(item.quantity ?? 0),
          reorderLevel: item.reorderLevel?.toNumber?.() ?? Number(item.reorderLevel ?? 0),
          stockValue:
            (item.quantity?.toNumber?.() ?? Number(item.quantity ?? 0)) *
            (item.product.costPrice?.toNumber?.() ?? Number(item.product.costPrice ?? 0)),
        })),
        meta: {
          total: items.length,
          page,
          limit,
          totalPages: Math.ceil(items.length / limit),
        },
      });
    }

    return res.status(200).json({
      data: items.map((item) => ({
        id: item.id,
        product: item.product,
        warehouse: item.warehouse,
        quantity: item.quantity?.toNumber?.() ?? Number(item.quantity ?? 0),
        reorderLevel: item.reorderLevel?.toNumber?.() ?? Number(item.reorderLevel ?? 0),
        stockValue:
          (item.quantity?.toNumber?.() ?? Number(item.quantity ?? 0)) *
          (item.product.costPrice?.toNumber?.() ?? Number(item.product.costPrice ?? 0)),
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Stock levels error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}
