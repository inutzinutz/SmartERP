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

    const asOfDate = req.query.asOfDate ? new Date(req.query.asOfDate as string) : new Date();

    // Get ALL active accounts in one query
    const accounts = await prisma.account.findMany({
      where: { organizationId: orgId, isActive: true },
      orderBy: { code: 'asc' },
    });

    // Get ALL aggregated balances in one raw query for efficiency
    const balances: any[] = await prisma.$queryRaw`
      SELECT 
        jel."accountId",
        SUM(jel.debit) as "totalDebit",
        SUM(jel.credit) as "totalCredit"
      FROM journal_entry_lines jel
      JOIN journal_entries je ON jel."journalEntryId" = je.id
      JOIN accounts a ON jel."accountId" = a.id
      WHERE a."organizationId" = ${orgId}
        AND je."isPosted" = true
        AND je.date <= ${asOfDate}
      GROUP BY jel."accountId"
    `;

    // Build a map of accountId -> { debit, credit }
    const balanceMap = new Map<string, { debit: number; credit: number }>();
    for (const b of balances) {
      balanceMap.set(b.accountId, {
        debit: toNum(b.totalDebit),
        credit: toNum(b.totalCredit),
      });
    }

    // Categorize accounts
    const categorize = (type: string, isDebitNormal: boolean) => {
      const filtered = accounts.filter((a: any) => a.type === type);
      const rows = filtered.map((a: any) => {
        const bal = balanceMap.get(a.id) || { debit: 0, credit: 0 };
        const amount = isDebitNormal ? bal.debit - bal.credit : bal.credit - bal.debit;
        return {
          accountId: a.id,
          accountCode: a.code,
          accountName: a.name,
          amount: Math.round(amount * 100) / 100,
        };
      });
      return rows;
    };

    const assetRows = categorize('ASSET', true);
    const liabilityRows = categorize('LIABILITY', false);
    const equityRows = categorize('EQUITY', false);
    const revenueRows = categorize('REVENUE', false);
    const expenseRows = categorize('EXPENSE', true);

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
