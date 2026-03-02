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

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    const [
      totalProducts,
      totalCustomers,
      totalSuppliers,
      totalWarehouses,
      activeUsers,
      currentMonthOrders,
      lastMonthOrders,
      currentMonthRevenue,
      lastMonthRevenue,
      pendingApprovals,
      lowStockCount,
      overdueReceivables,
      overduePayables,
    ] = await Promise.all([
      prisma.product.count({ where: { organizationId: orgId } }),
      prisma.customer.count({ where: { organizationId: orgId } }),
      prisma.supplier.count({ where: { organizationId: orgId } }),
      prisma.warehouse.count({ where: { organizationId: orgId } }),
      prisma.user.count({ where: { organizationId: orgId, isActive: true } }),
      prisma.salesOrder.count({
        where: { organizationId: orgId, createdAt: { gte: startOfMonth } },
      }),
      prisma.salesOrder.count({
        where: {
          organizationId: orgId,
          createdAt: { gte: startOfLastMonth, lte: endOfLastMonth },
        },
      }),
      prisma.salesOrder.aggregate({
        where: {
          organizationId: orgId,
          createdAt: { gte: startOfMonth },
          status: { in: ['CONFIRMED', 'DELIVERED'] },
        },
        _sum: { totalAmount: true },
      }),
      prisma.salesOrder.aggregate({
        where: {
          organizationId: orgId,
          createdAt: { gte: startOfLastMonth, lte: endOfLastMonth },
          status: { in: ['CONFIRMED', 'DELIVERED'] },
        },
        _sum: { totalAmount: true },
      }),
      prisma.approval.count({
        where: { organizationId: orgId, status: 'PENDING' },
      }),
      prisma.stockItem.count({
        where: {
          organizationId: orgId,
          quantity: { lte: prisma.stockItem.fields.reorderLevel },
        },
      }).catch(() =>
        prisma.stockItem.count({
          where: { organizationId: orgId, quantity: { lte: 10 } },
        })
      ),
      prisma.receivable.aggregate({
        where: {
          organizationId: orgId,
          status: { in: ['PENDING', 'OVERDUE'] },
          dueDate: { lt: now },
        },
        _sum: { amount: true },
      }),
      prisma.payable.aggregate({
        where: {
          organizationId: orgId,
          status: { in: ['PENDING', 'OVERDUE'] },
          dueDate: { lt: now },
        },
        _sum: { amount: true },
      }),
    ]);

    const currentRevenue = currentMonthRevenue._sum.totalAmount?.toNumber?.() ?? Number(currentMonthRevenue._sum.totalAmount ?? 0);
    const lastRevenue = lastMonthRevenue._sum.totalAmount?.toNumber?.() ?? Number(lastMonthRevenue._sum.totalAmount ?? 0);
    const revenueGrowth = lastRevenue > 0 ? ((currentRevenue - lastRevenue) / lastRevenue) * 100 : 0;
    const orderGrowth = lastMonthOrders > 0 ? ((currentMonthOrders - lastMonthOrders) / lastMonthOrders) * 100 : 0;

    return res.status(200).json({
      data: {
        counts: {
          totalProducts,
          totalCustomers,
          totalSuppliers,
          totalWarehouses,
          activeUsers,
        },
        currentMonth: {
          orders: currentMonthOrders,
          revenue: currentRevenue,
        },
        growth: {
          revenueGrowth: Math.round(revenueGrowth * 100) / 100,
          orderGrowth: Math.round(orderGrowth * 100) / 100,
        },
        alerts: {
          pendingApprovals,
          lowStockCount,
          overdueReceivables: overdueReceivables._sum.amount?.toNumber?.() ?? Number(overdueReceivables._sum.amount ?? 0),
          overduePayables: overduePayables._sum.amount?.toNumber?.() ?? Number(overduePayables._sum.amount ?? 0),
        },
      },
    });
  } catch (error) {
    console.error('Dashboard KPIs error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}
