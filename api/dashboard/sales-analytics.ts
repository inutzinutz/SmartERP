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

    const months = parseInt(req.query.months as string) || 12;
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);

    // Monthly sales data
    const orders = await prisma.salesOrder.findMany({
      where: {
        organizationId: orgId,
        createdAt: { gte: startDate },
        status: { in: ['CONFIRMED', 'DELIVERED'] },
      },
      select: {
        createdAt: true,
        totalAmount: true,
      },
    });

    const monthlySales: Record<string, { month: string; revenue: number; orderCount: number }> = {};
    for (let i = 0; i < months; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthlySales[key] = { month: key, revenue: 0, orderCount: 0 };
    }

    for (const order of orders) {
      const d = new Date(order.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (monthlySales[key]) {
        monthlySales[key].revenue += order.totalAmount?.toNumber?.() ?? Number(order.totalAmount ?? 0);
        monthlySales[key].orderCount += 1;
      }
    }

    const monthlySalesArray = Object.values(monthlySales).sort((a, b) => a.month.localeCompare(b.month));

    // Top customers by revenue
    const topCustomers = await prisma.salesOrder.groupBy({
      by: ['customerId'],
      where: {
        organizationId: orgId,
        createdAt: { gte: startDate },
        status: { in: ['CONFIRMED', 'DELIVERED'] },
      },
      _sum: { totalAmount: true },
      _count: { id: true },
      orderBy: { _sum: { totalAmount: 'desc' } },
      take: 10,
    });

    const customerIds = topCustomers.map((c) => c.customerId);
    const customers = await prisma.customer.findMany({
      where: { id: { in: customerIds } },
      select: { id: true, name: true },
    });
    const customerMap = new Map(customers.map((c) => [c.id, c.name]));

    const topCustomersData = topCustomers.map((c) => ({
      customerId: c.customerId,
      customerName: customerMap.get(c.customerId) ?? 'Unknown',
      totalRevenue: c._sum.totalAmount?.toNumber?.() ?? Number(c._sum.totalAmount ?? 0),
      orderCount: c._count.id,
    }));

    // Top products by quantity sold
    const topProducts = await prisma.salesOrderItem.groupBy({
      by: ['productId'],
      where: {
        salesOrder: {
          organizationId: orgId,
          createdAt: { gte: startDate },
          status: { in: ['CONFIRMED', 'DELIVERED'] },
        },
      },
      _sum: { quantity: true, totalPrice: true },
      orderBy: { _sum: { totalPrice: 'desc' } },
      take: 10,
    });

    const productIds = topProducts.map((p) => p.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true, sku: true },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

    const topProductsData = topProducts.map((p) => ({
      productId: p.productId,
      productName: productMap.get(p.productId)?.name ?? 'Unknown',
      sku: productMap.get(p.productId)?.sku ?? '',
      totalQuantity: p._sum.quantity?.toNumber?.() ?? Number(p._sum.quantity ?? 0),
      totalRevenue: p._sum.totalPrice?.toNumber?.() ?? Number(p._sum.totalPrice ?? 0),
    }));

    return res.status(200).json({
      data: {
        monthlySales: monthlySalesArray,
        topCustomers: topCustomersData,
        topProducts: topProductsData,
      },
    });
  } catch (error) {
    console.error('Sales analytics error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}
