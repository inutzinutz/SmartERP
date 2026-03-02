import type { VercelRequest, VercelResponse } from '@vercel/node';
import prisma from '../../_lib/prisma';
import { getUserFromRequest } from '../../_lib/auth';
import { cors } from '../../_lib/cors';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;

  const auth = getUserFromRequest(req);
  if (!auth) return res.status(401).json({ message: 'Unauthorized' });

  const user = await prisma.user.findUnique({
    where: { id: auth.sub },
    select: { organizationId: true },
  });
  if (!user) return res.status(404).json({ message: 'User not found' });
  const orgId = user.organizationId;

  const id = req.query.id as string;
  if (!id) return res.status(400).json({ message: 'Account ID is required' });

  try {
    switch (req.method) {
      case 'GET': {
        const account = await prisma.account.findFirst({
          where: { id, organizationId: orgId },
          include: {
            parent: { select: { id: true, code: true, name: true } },
            children: { select: { id: true, code: true, name: true, type: true, isActive: true } },
            journalEntryLines: {
              orderBy: { journalEntry: { date: 'desc' } },
              take: 20,
              include: {
                  journalEntry: {
                  select: { id: true, entryNumber: true, date: true, description: true, isPosted: true },
                },
              },
            },
          },
        });

        if (!account) {
          return res.status(404).json({ message: 'Account not found' });
        }

        // Calculate balance
        const debitSum = await prisma.journalEntryLine.aggregate({
          where: {
            accountId: id,
            journalEntry: { isPosted: true },
          },
          _sum: { debit: true },
        });

        const creditSum = await prisma.journalEntryLine.aggregate({
          where: {
            accountId: id,
            journalEntry: { isPosted: true },
          },
          _sum: { credit: true },
        });

        const totalDebit = debitSum._sum?.debit?.toNumber?.() ?? Number(debitSum._sum?.debit ?? 0);
        const totalCredit = creditSum._sum?.credit?.toNumber?.() ?? Number(creditSum._sum?.credit ?? 0);

        // For ASSET and EXPENSE accounts, balance = debit - credit
        // For LIABILITY, EQUITY, REVENUE accounts, balance = credit - debit
        const isDebitNormal = ['ASSET', 'EXPENSE'].includes(account.type);
        const balance = isDebitNormal ? totalDebit - totalCredit : totalCredit - totalDebit;

        return res.status(200).json({
          data: {
            ...account,
            balance: Math.round(balance * 100) / 100,
            totalDebit: Math.round(totalDebit * 100) / 100,
            totalCredit: Math.round(totalCredit * 100) / 100,
          },
        });
      }

      case 'PUT': {
        const existing = await prisma.account.findFirst({
          where: { id, organizationId: orgId },
        });
        if (!existing) {
          return res.status(404).json({ message: 'Account not found' });
        }

        const { code, name, type, parentId, isActive } = req.body;

        if (code && code !== existing.code) {
          const duplicate = await prisma.account.findFirst({
            where: { organizationId: orgId, code, id: { not: id } },
          });
          if (duplicate) {
            return res.status(409).json({ message: 'An account with this code already exists' });
          }
        }

        if (parentId === id) {
          return res.status(400).json({ message: 'An account cannot be its own parent' });
        }

        const account = await prisma.account.update({
          where: { id },
          data: {
            ...(code !== undefined && { code }),
            ...(name !== undefined && { name }),
            ...(type !== undefined && { type }),
            ...(parentId !== undefined && { parentId: parentId || null }),
            ...(isActive !== undefined && { isActive }),
          },
        });

        return res.status(200).json({ data: account });
      }

      case 'DELETE': {
        const existing = await prisma.account.findFirst({
          where: { id, organizationId: orgId },
        });
        if (!existing) {
          return res.status(404).json({ message: 'Account not found' });
        }

        // Check for child accounts
        const childCount = await prisma.account.count({ where: { parentId: id } });
        if (childCount > 0) {
          return res.status(400).json({
            message: 'Cannot delete account with child accounts. Remove or reassign child accounts first.',
          });
        }

        // Check for journal entry lines
        const lineCount = await prisma.journalEntryLine.count({ where: { accountId: id } });
        if (lineCount > 0) {
          return res.status(400).json({
            message: 'Cannot delete account with journal entries. Deactivate instead.',
          });
        }

        await prisma.account.delete({ where: { id } });

        return res.status(200).json({ message: 'Account deleted' });
      }

      default:
        return res.status(405).json({ message: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Account [id] error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}
