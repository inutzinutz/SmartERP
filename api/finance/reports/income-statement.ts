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
    const startDate = req.query.startDate
      ? new Date(req.query.startDate as string)
      : new Date(now.getFullYear(), 0, 1); // Default: start of year
    const endDate = req.query.endDate
      ? new Date(req.query.endDate as string)
      : now;

    // Get revenue accounts
    const revenueAccounts = await prisma.account.findMany({
      where: { organizationId: orgId, type: 'REVENUE', isActive: true },
      orderBy: { code: 'asc' },
    });

    // Get expense accounts
    const expenseAccounts = await prisma.account.findMany({
      where: { organizationId: orgId, type: 'EXPENSE', isActive: true },
      orderBy: { code: 'asc' },
    });

    // Calculate balances for revenue accounts
    const revenueRows = await Promise.all(
      revenueAccounts.map(async (account: any) => {
        const agg = await prisma.journalEntryLine.aggregate({
          where: {
            accountId: account.id,
            journalEntry: {
              isPosted: true,
              date: { gte: startDate, lte: endDate },
            },
          },
          _sum: { debit: true, credit: true },
        });

        const debit = agg._sum?.debit?.toNumber?.() ?? Number(agg._sum?.debit ?? 0);
        const credit = agg._sum?.credit?.toNumber?.() ?? Number(agg._sum?.credit ?? 0);
        // Revenue is credit-normal
        const balance = credit - debit;

        return {
          accountId: account.id,
          accountCode: account.code,
          accountName: account.name,
          amount: Math.round(balance * 100) / 100,
        };
      })
    );

    // Calculate balances for expense accounts
    const expenseRows = await Promise.all(
      expenseAccounts.map(async (account: any) => {
        const agg = await prisma.journalEntryLine.aggregate({
          where: {
            accountId: account.id,
            journalEntry: {
              isPosted: true,
              date: { gte: startDate, lte: endDate },
            },
          },
          _sum: { debit: true, credit: true },
        });

        const debit = agg._sum?.debit?.toNumber?.() ?? Number(agg._sum?.debit ?? 0);
        const credit = agg._sum?.credit?.toNumber?.() ?? Number(agg._sum?.credit ?? 0);
        // Expense is debit-normal
        const balance = debit - credit;

        return {
          accountId: account.id,
          accountCode: account.code,
          accountName: account.name,
          amount: Math.round(balance * 100) / 100,
        };
      })
    );

    const totalRevenue = revenueRows.reduce((sum: number, r: any) => sum + r.amount, 0);
    const totalExpenses = expenseRows.reduce((sum: number, r: any) => sum + r.amount, 0);
    const netIncome = totalRevenue - totalExpenses;

    return res.status(200).json({
      data: {
        period: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
        revenue: {
          rows: revenueRows.filter((r) => r.amount !== 0),
          total: Math.round(totalRevenue * 100) / 100,
        },
        expenses: {
          rows: expenseRows.filter((r) => r.amount !== 0),
          total: Math.round(totalExpenses * 100) / 100,
        },
        netIncome: Math.round(netIncome * 100) / 100,
      },
    });
  } catch (error) {
    console.error('Income statement error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}
