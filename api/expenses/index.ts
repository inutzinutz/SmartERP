import type { VercelRequest, VercelResponse } from '@vercel/node';
import prisma from '../../lib/prisma';
import { getUserFromRequest } from '../../lib/auth';
import { cors } from '../../lib/cors';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;

  const auth = getUserFromRequest(req);
  if (!auth) return res.status(401).json({ message: 'Unauthorized' });

  const user = await prisma.user.findUnique({
    where: { id: auth.sub },
    select: { organizationId: true, role: true },
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
        const all = req.query.all === 'true'; // admins can see all
        const sortBy = (req.query.sortBy as string) || 'createdAt';
        const sortOrder = (req.query.sortOrder as string) === 'asc' ? 'asc' : 'desc';

        const where: any = { organizationId: orgId };

        // Regular users only see their own expenses
        if (!all || !['ADMIN', 'MANAGER'].includes(user.role)) {
          where.userId = auth.sub;
        }

        if (status) where.status = status;

        if (search) {
          where.OR = [
            { title: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
          ];
        }

        const [data, total] = await Promise.all([
          prisma.expenseClaim.findMany({
            where,
            include: {
              user: { select: { id: true, name: true, email: true } },
              items: true,
              _count: { select: { items: true } },
            },
            orderBy: { [sortBy]: sortOrder },
            skip: (page - 1) * limit,
            take: limit,
          }),
          prisma.expenseClaim.count({ where }),
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
        const { title, description, items } = req.body;

        if (!title) {
          return res.status(400).json({ message: 'Expense claim title is required' });
        }
        if (!items || !Array.isArray(items) || items.length === 0) {
          return res.status(400).json({ message: 'At least one expense item is required' });
        }

        // Validate items
        const expenseItems = items.map((item: any, index: number) => {
          if (!item.description || item.amount === undefined) {
            throw new Error(`Item ${index + 1}: description and amount are required`);
          }
          const amount = Number(item.amount);
          if (isNaN(amount) || amount <= 0) {
            throw new Error(`Item ${index + 1}: amount must be a positive number`);
          }

          return {
            description: item.description,
            amount,
            category: item.category || null,
            date: item.date ? new Date(item.date) : new Date(),
            receiptUrl: item.receiptUrl || null,
          };
        });

        const totalAmount = expenseItems.reduce((sum: number, item: any) => sum + item.amount, 0);

        const claim = await prisma.$transaction(async (tx) => {
          return tx.expenseClaim.create({
            data: {
              organizationId: orgId,
              userId: auth.sub,
              title,
              description: description || null,
              totalAmount,
              status: 'DRAFT',
              items: {
                create: expenseItems,
              },
            },
            include: {
              user: { select: { id: true, name: true, email: true } },
              items: true,
            },
          });
        });

        return res.status(201).json({ data: claim });
      }

      default:
        return res.status(405).json({ message: 'Method not allowed' });
    }
  } catch (error: any) {
    console.error('Expenses error:', error);
    if (error.message?.includes('Item ')) {
      return res.status(400).json({ message: error.message });
    }
    return res.status(500).json({ message: 'Internal server error' });
  }
}
