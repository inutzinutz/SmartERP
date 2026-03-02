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

  try {
    switch (req.method) {
      case 'GET': {
        const page = Math.max(1, parseInt(req.query.page as string) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
        const search = (req.query.search as string) || '';
        const status = req.query.status as string;
        const startDate = req.query.startDate as string;
        const endDate = req.query.endDate as string;
        const sortBy = (req.query.sortBy as string) || 'date';
        const sortOrder = (req.query.sortOrder as string) === 'asc' ? 'asc' : 'desc';

        const where: any = { organizationId: orgId };

        if (status) where.status = status;

        if (startDate || endDate) {
          where.date = {};
          if (startDate) where.date.gte = new Date(startDate);
          if (endDate) where.date.lte = new Date(endDate);
        }

        if (search) {
          where.OR = [
            { entryNumber: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
            { reference: { contains: search, mode: 'insensitive' } },
          ];
        }

        const [data, total] = await Promise.all([
          prisma.journalEntry.findMany({
            where,
            include: {
              lines: {
                include: {
                  account: { select: { id: true, code: true, name: true } },
                },
              },
              createdByUser: { select: { id: true, name: true } },
            },
            orderBy: { [sortBy]: sortOrder },
            skip: (page - 1) * limit,
            take: limit,
          }),
          prisma.journalEntry.count({ where }),
        ]);

        return res.status(200).json({
          data,
          meta: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
          },
        });
      }

      case 'POST': {
        const { date, description, reference, lines } = req.body;

        if (!lines || !Array.isArray(lines) || lines.length < 2) {
          return res.status(400).json({
            message: 'At least two journal entry lines are required',
          });
        }

        // Validate debit = credit
        let totalDebit = 0;
        let totalCredit = 0;
        for (const line of lines) {
          const debit = Number(line.debit ?? 0);
          const credit = Number(line.credit ?? 0);

          if (debit < 0 || credit < 0) {
            return res.status(400).json({ message: 'Debit and credit amounts must be non-negative' });
          }
          if (debit > 0 && credit > 0) {
            return res.status(400).json({
              message: 'A line cannot have both debit and credit amounts',
            });
          }
          if (debit === 0 && credit === 0) {
            return res.status(400).json({
              message: 'Each line must have either a debit or credit amount',
            });
          }

          totalDebit += debit;
          totalCredit += credit;
        }

        if (Math.abs(totalDebit - totalCredit) > 0.01) {
          return res.status(400).json({
            message: `Total debits (${totalDebit.toFixed(2)}) must equal total credits (${totalCredit.toFixed(2)})`,
          });
        }

        // Verify all accounts exist and belong to org
        const accountIds = lines.map((l: any) => l.accountId);
        const accounts = await prisma.account.findMany({
          where: { id: { in: accountIds }, organizationId: orgId },
        });

        if (accounts.length !== new Set(accountIds).size) {
          return res.status(400).json({ message: 'One or more accounts not found' });
        }

        // Generate entry number
        const lastEntry = await prisma.journalEntry.findFirst({
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

        const entry = await prisma.$transaction(async (tx: any) => {
          return tx.journalEntry.create({
            data: {
              organizationId: orgId,
              entryNumber,
              date: date ? new Date(date) : new Date(),
              description: description || null,
              reference: reference || null,
              status: 'DRAFT',
              totalAmount: totalDebit,
              createdBy: auth.sub,
              lines: {
                create: lines.map((line: any) => ({
                  accountId: line.accountId,
                  debit: Number(line.debit ?? 0),
                  credit: Number(line.credit ?? 0),
                  description: line.description || null,
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
        });

        return res.status(201).json({ data: entry });
      }

      default:
        return res.status(405).json({ message: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Journal entries error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}
