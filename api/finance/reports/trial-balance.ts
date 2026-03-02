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

    // Get all accounts for the org
    const accounts = await prisma.account.findMany({
      where: { organizationId: orgId, isActive: true },
      orderBy: { code: 'asc' },
    });

    // Get ALL aggregated balances in one raw query
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

    const balanceMap = new Map<string, { debit: number; credit: number }>();
    for (const b of balances) {
      balanceMap.set(b.accountId, {
        debit: toNum(b.totalDebit),
        credit: toNum(b.totalCredit),
      });
    }

    const accountBalances = accounts.map((account: any) => {
      const bal = balanceMap.get(account.id) || { debit: 0, credit: 0 };
      return {
        accountId: account.id,
        accountCode: account.code,
        accountName: account.name,
        accountType: account.type,
        debit: Math.round(bal.debit * 100) / 100,
        credit: Math.round(bal.credit * 100) / 100,
        balance: Math.round((bal.debit - bal.credit) * 100) / 100,
      };
    });

    // Filter out zero-balance accounts
    const nonZeroBalances = accountBalances.filter(
      (a) => a.debit !== 0 || a.credit !== 0
    );

    // Calculate totals
    const totalDebits = nonZeroBalances.reduce((sum, a) => sum + a.debit, 0);
    const totalCredits = nonZeroBalances.reduce((sum, a) => sum + a.credit, 0);

    // For trial balance display: show debit or credit balance per account
    const trialBalanceRows = nonZeroBalances.map((a) => {
      const netBalance = a.debit - a.credit;
      return {
        ...a,
        debitBalance: netBalance > 0 ? Math.round(netBalance * 100) / 100 : 0,
        creditBalance: netBalance < 0 ? Math.round(Math.abs(netBalance) * 100) / 100 : 0,
      };
    });

    const totalDebitBalance = trialBalanceRows.reduce((sum, r) => sum + r.debitBalance, 0);
    const totalCreditBalance = trialBalanceRows.reduce((sum, r) => sum + r.creditBalance, 0);

    return res.status(200).json({
      data: {
        asOfDate: asOfDate.toISOString(),
        rows: trialBalanceRows,
        totals: {
          debit: Math.round(totalDebits * 100) / 100,
          credit: Math.round(totalCredits * 100) / 100,
          debitBalance: Math.round(totalDebitBalance * 100) / 100,
          creditBalance: Math.round(totalCreditBalance * 100) / 100,
          isBalanced: Math.abs(totalDebitBalance - totalCreditBalance) < 0.01,
        },
      },
    });
  } catch (error) {
    console.error('Trial balance error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}
