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

async function getAccountBalances(
  orgId: string,
  type: string,
  asOfDate: Date,
  isDebitNormal: boolean
) {
  const accounts = await prisma.account.findMany({
    where: { organizationId: orgId, type: type as any, isActive: true },
    orderBy: { code: 'asc' },
  });

  const rows = await Promise.all(
    accounts.map(async (account: any) => {
      const agg = await prisma.journalEntryLine.aggregate({
        where: {
          accountId: account.id,
          journalEntry: {
            isPosted: true,
            date: { lte: asOfDate },
          },
        },
        _sum: { debit: true, credit: true },
      });

      const debit = toNum(agg._sum?.debit);
      const credit = toNum(agg._sum?.credit);
      const balance = isDebitNormal ? debit - credit : credit - debit;

      return {
        accountId: account.id,
        accountCode: account.code,
        accountName: account.name,
        amount: Math.round(balance * 100) / 100,
      };
    })
  );

  return rows;
}

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

    const asOfDate = req.query.asOfDate ? new Date(req.query.asOfDate as string) : new Date();

    // Get balances for each category
    const [assetRows, liabilityRows, equityRows] = await Promise.all([
      getAccountBalances(orgId, 'ASSET', asOfDate, true),
      getAccountBalances(orgId, 'LIABILITY', asOfDate, false),
      getAccountBalances(orgId, 'EQUITY', asOfDate, false),
    ]);

    // Calculate retained earnings (Revenue - Expenses for all time up to asOfDate)
    const revenueRows = await getAccountBalances(orgId, 'REVENUE', asOfDate, false);
    const expenseRows = await getAccountBalances(orgId, 'EXPENSE', asOfDate, true);

    const totalRevenue = revenueRows.reduce((sum: number, r: any) => sum + r.amount, 0);
    const totalExpenses = expenseRows.reduce((sum: number, r: any) => sum + r.amount, 0);
    const retainedEarnings = Math.round((totalRevenue - totalExpenses) * 100) / 100;

    const totalAssets = assetRows.reduce((sum: number, r: any) => sum + r.amount, 0);
    const totalLiabilities = liabilityRows.reduce((sum: number, r: any) => sum + r.amount, 0);
    const totalEquity = equityRows.reduce((sum: number, r: any) => sum + r.amount, 0) + retainedEarnings;

    return res.status(200).json({
      data: {
        asOfDate: asOfDate.toISOString(),
        assets: {
          rows: assetRows.filter((r) => r.amount !== 0),
          total: Math.round(totalAssets * 100) / 100,
        },
        liabilities: {
          rows: liabilityRows.filter((r) => r.amount !== 0),
          total: Math.round(totalLiabilities * 100) / 100,
        },
        equity: {
          rows: equityRows.filter((r) => r.amount !== 0),
          retainedEarnings,
          total: Math.round(totalEquity * 100) / 100,
        },
        totalLiabilitiesAndEquity: Math.round((totalLiabilities + totalEquity) * 100) / 100,
        isBalanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01,
      },
    });
  } catch (error) {
    console.error('Balance sheet error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}
