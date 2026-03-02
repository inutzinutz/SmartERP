import type { VercelRequest, VercelResponse } from '@vercel/node';
import prisma from '../../../lib/prisma';
import { getUserFromRequest } from '../../../lib/auth';
import { cors } from '../../../lib/cors';

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
  if (!id) return res.status(400).json({ message: 'Journal entry ID is required' });

  try {
    switch (req.method) {
      case 'GET': {
        const entry = await prisma.journalEntry.findFirst({
          where: { id, organizationId: orgId },
          include: {
            lines: {
              include: {
                account: { select: { id: true, code: true, name: true, type: true } },
              },
            },
            createdByUser: { select: { id: true, name: true, email: true } },
          },
        });

        if (!entry) {
          return res.status(404).json({ message: 'Journal entry not found' });
        }

        return res.status(200).json({ data: entry });
      }

      case 'PATCH': {
        const existing = await prisma.journalEntry.findFirst({
          where: { id, organizationId: orgId },
          include: { lines: true },
        });
        if (!existing) {
          return res.status(404).json({ message: 'Journal entry not found' });
        }

        const { action } = req.body;

        if (action === 'post') {
          if (existing.status !== 'DRAFT') {
            return res.status(400).json({ message: 'Only draft entries can be posted' });
          }

          // Verify debit = credit
          let totalDebit = 0;
          let totalCredit = 0;
          for (const line of existing.lines) {
            totalDebit += line.debit?.toNumber?.() ?? Number(line.debit ?? 0);
            totalCredit += line.credit?.toNumber?.() ?? Number(line.credit ?? 0);
          }

          if (Math.abs(totalDebit - totalCredit) > 0.01) {
            return res.status(400).json({
              message: 'Cannot post: debits and credits are not balanced',
            });
          }

          const entry = await prisma.journalEntry.update({
            where: { id },
            data: { status: 'POSTED', postedAt: new Date() },
            include: {
              lines: {
                include: {
                  account: { select: { id: true, code: true, name: true } },
                },
              },
            },
          });

          return res.status(200).json({ data: entry });
        }

        if (action === 'void') {
          if (existing.status !== 'POSTED') {
            return res.status(400).json({ message: 'Only posted entries can be voided' });
          }

          // Create a reversing entry in a transaction
          const result = await prisma.$transaction(async (tx) => {
            // Void the original entry
            const voided = await tx.journalEntry.update({
              where: { id },
              data: { status: 'VOIDED' },
            });

            // Generate reversing entry number
            const lastEntry = await tx.journalEntry.findFirst({
              where: { organizationId: orgId },
              orderBy: { createdAt: 'desc' },
              select: { entryNumber: true },
            });

            let nextNum = 1;
            if (lastEntry?.entryNumber) {
              const match = lastEntry.entryNumber.match(/(\d+)$/);
              if (match) nextNum = parseInt(match[1]) + 1;
            }
            const entryNumber = `JE-${String(nextNum).padStart(6, '0')}`;

            // Create reversing entry with debits and credits swapped
            const reversingEntry = await tx.journalEntry.create({
              data: {
                organizationId: orgId,
                entryNumber,
                date: new Date(),
                description: `Reversal of ${existing.entryNumber}: ${existing.description || ''}`,
                reference: `VOID-${existing.entryNumber}`,
                status: 'POSTED',
                totalAmount: existing.totalAmount,
                postedAt: new Date(),
                createdBy: auth.sub,
                lines: {
                  create: existing.lines.map((line) => ({
                    accountId: line.accountId,
                    debit: line.credit?.toNumber?.() ?? Number(line.credit ?? 0),
                    credit: line.debit?.toNumber?.() ?? Number(line.debit ?? 0),
                    description: `Reversal: ${line.description || ''}`,
                  })),
                },
              },
              include: {
                lines: {
                  include: {
                    account: { select: { id: true, code: true, name: true } },
                  },
                },
              },
            });

            return { voidedEntry: voided, reversingEntry };
          });

          return res.status(200).json({
            data: result,
            message: 'Entry voided and reversing entry created',
          });
        }

        return res.status(400).json({ message: 'Invalid action. Use "post" or "void"' });
      }

      default:
        return res.status(405).json({ message: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Journal entry [id] error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}
