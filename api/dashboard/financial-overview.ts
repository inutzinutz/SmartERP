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

    const months = parseInt(req.query.months as string) || 12;
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);

    // Monthly revenue from confirmed/delivered sales
    const salesOrders = await prisma.salesOrder.findMany({
      where: {
        customer: { organizationId: orgId },
        createdAt: { gte: startDate },
        status: { in: ['CONFIRMED', 'DELIVERED'] },
      },
      select: { createdAt: true, totalAmount: true },
    });

    // Monthly expenses from approved expense claims
    const expenseClaims = await prisma.expenseClaim.findMany({
      where: {
        user: { organizationId: orgId },
        createdAt: { gte: startDate },
        status: 'APPROVED',
      },
      select: { createdAt: true, totalAmount: true },
    });

    // Purchase orders as cost of goods
    const purchaseOrders = await prisma.purchaseOrder.findMany({
      where: {
        supplier: { organizationId: orgId },
        createdAt: { gte: startDate },
        status: { in: ['CONFIRMED', 'DELIVERED'] },
      },
      select: { createdAt: true, totalAmount: true },
    });

    // Build monthly data
    const monthlyData: Record<string, { month: string; revenue: number; expenses: number; purchases: number }> = {};
    for (let i = 0; i < months; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthlyData[key] = { month: key, revenue: 0, expenses: 0, purchases: 0 };
    }

    for (const order of salesOrders) {
      const d = new Date(order.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (monthlyData[key]) {
        monthlyData[key].revenue += Number(order.totalAmount ?? 0);
      }
    }

    for (const claim of expenseClaims) {
      const d = new Date(claim.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (monthlyData[key]) {
        monthlyData[key].expenses += Number(claim.totalAmount ?? 0);
      }
    }

    for (const po of purchaseOrders) {
      const d = new Date(po.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (monthlyData[key]) {
        monthlyData[key].purchases += Number(po.totalAmount ?? 0);
      }
    }

    const monthlyArray = Object.values(monthlyData)
      .sort((a, b) => a.month.localeCompare(b.month))
      .map((m) => ({
        ...m,
        revenue: Math.round(m.revenue * 100) / 100,
        expenses: Math.round(m.expenses * 100) / 100,
        purchases: Math.round(m.purchases * 100) / 100,
        netIncome: Math.round((m.revenue - m.expenses - m.purchases) * 100) / 100,
      }));

    // Overdue receivables
    const overdueReceivables = await prisma.receivable.findMany({
      where: {
        customer: { organizationId: orgId },
        status: { in: ['PENDING', 'OVERDUE'] },
        dueDate: { lt: now },
      },
      include: {
        customer: { select: { name: true } },
      },
      orderBy: { dueDate: 'asc' },
      take: 20,
    });

    const totalOverdueReceivable = overdueReceivables.reduce(
      (sum: number, r) => sum + Number(r.amount ?? 0),
      0
    );

    // Overdue payables
    const overduePayables = await prisma.payable.findMany({
      where: {
        supplier: { organizationId: orgId },
        status: { in: ['PENDING', 'OVERDUE'] },
        dueDate: { lt: now },
      },
      include: {
        supplier: { select: { name: true } },
      },
      orderBy: { dueDate: 'asc' },
      take: 20,
    });

    const totalOverduePayable = overduePayables.reduce(
      (sum: number, p) => sum + Number(p.amount ?? 0),
      0
    );

    // Recent payments
    const recentPayments = await prisma.payment.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return res.status(200).json({
      data: {
        monthlyData: monthlyArray,
        overdueReceivables: {
          total: Math.round(totalOverdueReceivable * 100) / 100,
          count: overdueReceivables.length,
          items: overdueReceivables.map((r) => ({
            id: r.id,
            customerName: r.customer?.name ?? 'N/A',
            amount: Number(r.amount ?? 0),
            dueDate: r.dueDate,
          })),
        },
        overduePayables: {
          total: Math.round(totalOverduePayable * 100) / 100,
          count: overduePayables.length,
          items: overduePayables.map((p) => ({
            id: p.id,
            supplierName: p.supplier?.name ?? 'N/A',
            amount: Number(p.amount ?? 0),
            dueDate: p.dueDate,
          })),
        },
        recentPayments: recentPayments.map((p) => ({
          id: p.id,
          amount: Number(p.amount ?? 0),
          paymentMethod: p.paymentMethod,
          reference: p.reference,
          createdAt: p.createdAt,
        })),
      },
    });
  } catch (error) {
    console.error('Financial overview error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}
