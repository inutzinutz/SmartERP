import type { VercelRequest, VercelResponse } from '@vercel/node';
import prisma from '../../_lib/prisma';
import { getUserFromRequest } from '../../_lib/auth';
import { cors } from '../../_lib/cors';

// Helper to safely convert Prisma Decimal to number
const toNum = (val: any): number => {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return val;
  if (typeof val.toNumber === 'function') return val.toNumber();
  return Number(val) || 0;
};

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

    // Get revenue and expense accounts
    const accounts = await prisma.account.findMany({
      where: {
        organizationId: orgId,
        type: { in: ['REVENUE', 'EXPENSE'] },
        isActive: true,
      },
      orderBy: { code: 'asc' },
    });

    // Get aggregated balances in one raw query for the period
    const balances: any[] = await prisma.$queryRaw`
      SELECT 
        jel."accountId",
        SUM(jel.debit) as "totalDebit",
        SUM(jel.credit) as "totalCredit"
      FROM journal_entry_lines jel
      JOIN journal_entries je ON jel."journalEntryId" = je.id
      JOIN accounts a ON jel."accountId" = a.id
      WHERE a."organizationId" = ${orgId}
        AND a.type IN ('REVENUE', 'EXPENSE')
        AND je."isPosted" = true
        AND je.date >= ${startDate}
        AND je.date <= ${endDate}
      GROUP BY jel."accountId"
    `;

    const balanceMap = new Map<string, { debit: number; credit: number }>();
    for (const b of balances) {
      balanceMap.set(b.accountId, {
        debit: toNum(b.totalDebit),
        credit: toNum(b.totalCredit),
      });
    }

    const revenueAccounts = accounts.filter((a: any) => a.type === 'REVENUE');
    const expenseAccounts = accounts.filter((a: any) => a.type === 'EXPENSE');

    const revenueRows = revenueAccounts.map((account: any) => {
      const bal = balanceMap.get(account.id) || { debit: 0, credit: 0 };
      // Revenue is credit-normal
      const balance = bal.credit - bal.debit;
      return {
        accountId: account.id,
        accountCode: account.code,
        accountName: account.name,
        amount: Math.round(balance * 100) / 100,
      };
    });

    const expenseRows = expenseAccounts.map((account: any) => {
      const bal = balanceMap.get(account.id) || { debit: 0, credit: 0 };
      // Expense is debit-normal
      const balance = bal.debit - bal.credit;
      return {
        accountId: account.id,
        accountCode: account.code,
        accountName: account.name,
        amount: Math.round(balance * 100) / 100,
      };
    });

    const totalRevenue = revenueRows.reduce((sum, r) => sum + r.amount, 0);
    const totalExpenses = expenseRows.reduce((sum, r) => sum + r.amount, 0);
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
