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

    const asOfDate = req.query.asOfDate ? new Date(req.query.asOfDate as string) : new Date();

    // Get all accounts for the org
    const accounts = await prisma.account.findMany({
      where: { organizationId: orgId, isActive: true },
      orderBy: { code: 'asc' },
    });

    // Get aggregated journal entry lines for each account up to the asOfDate
    const accountBalances = await Promise.all(
      accounts.map(async (account: any) => {
        const aggregation = await prisma.journalEntryLine.aggregate({
          where: {
            accountId: account.id,
            journalEntry: {
              isPosted: true,
              date: { lte: asOfDate },
            },
          },
          _sum: { debit: true, credit: true },
        });

        const totalDebit = aggregation._sum?.debit?.toNumber?.() ?? Number(aggregation._sum?.debit ?? 0);
        const totalCredit = aggregation._sum?.credit?.toNumber?.() ?? Number(aggregation._sum?.credit ?? 0);

        return {
          accountId: account.id,
          accountCode: account.code,
          accountName: account.name,
          accountType: account.type,
          debit: Math.round(totalDebit * 100) / 100,
          credit: Math.round(totalCredit * 100) / 100,
          balance: Math.round((totalDebit - totalCredit) * 100) / 100,
        };
      })
    );

    // Filter out zero-balance accounts
    const nonZeroBalances = accountBalances.filter(
      (a: any) => a.debit !== 0 || a.credit !== 0
    );

    // Calculate totals
    const totalDebits = nonZeroBalances.reduce((sum: number, a: any) => sum + a.debit, 0);
    const totalCredits = nonZeroBalances.reduce((sum: number, a: any) => sum + a.credit, 0);

    // For trial balance display: show debit or credit balance per account
    const trialBalanceRows = nonZeroBalances.map((a: any) => {
      const isDebitNormal = ['ASSET', 'EXPENSE'].includes(a.accountType);
      const netBalance = a.debit - a.credit;

      return {
        ...a,
        debitBalance: netBalance > 0 ? Math.round(netBalance * 100) / 100 : 0,
        creditBalance: netBalance < 0 ? Math.round(Math.abs(netBalance) * 100) / 100 : 0,
      };
    });

    const totalDebitBalance = trialBalanceRows.reduce((sum: number, r: any) => sum + r.debitBalance, 0);
    const totalCreditBalance = trialBalanceRows.reduce((sum: number, r: any) => sum + r.creditBalance, 0);

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
