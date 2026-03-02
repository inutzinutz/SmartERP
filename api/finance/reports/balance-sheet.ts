import type { VercelRequest, VercelResponse } from '@vercel/node';
import prisma from '../../../lib/prisma';
import { getUserFromRequest } from '../../../lib/auth';
import { cors } from '../../../lib/cors';

async function getAccountBalances(
  orgId: string,
  type: string,
  asOfDate: Date,
  isDebitNormal: boolean
) {
  const accounts = await prisma.account.findMany({
    where: { organizationId: orgId, type, isActive: true },
    orderBy: { code: 'asc' },
  });

  const rows = await Promise.all(
    accounts.map(async (account) => {
      const agg = await prisma.journalEntryLine.aggregate({
        where: {
          accountId: account.id,
          journalEntry: {
            organizationId: orgId,
            status: 'POSTED',
            date: { lte: asOfDate },
          },
        },
        _sum: { debit: true, credit: true },
      });

      const debit = agg._sum.debit?.toNumber?.() ?? Number(agg._sum.debit ?? 0);
      const credit = agg._sum.credit?.toNumber?.() ?? Number(agg._sum.credit ?? 0);
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

    const totalRevenue = revenueRows.reduce((sum, r) => sum + r.amount, 0);
    const totalExpenses = expenseRows.reduce((sum, r) => sum + r.amount, 0);
    const retainedEarnings = Math.round((totalRevenue - totalExpenses) * 100) / 100;

    const totalAssets = assetRows.reduce((sum, r) => sum + r.amount, 0);
    const totalLiabilities = liabilityRows.reduce((sum, r) => sum + r.amount, 0);
    const totalEquity = equityRows.reduce((sum, r) => sum + r.amount, 0) + retainedEarnings;

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
