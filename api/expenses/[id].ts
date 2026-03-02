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
    select: { organizationId: true, role: true },
  });
  if (!user) return res.status(404).json({ message: 'User not found' });
  const orgId = user.organizationId;

  const id = req.query.id as string;
  if (!id) return res.status(400).json({ message: 'Expense claim ID is required' });

  try {
    switch (req.method) {
      case 'GET': {
        const claim = await prisma.expenseClaim.findFirst({
          where: { id, organizationId: orgId },
          include: {
            user: { select: { id: true, name: true, email: true } },
            items: true,
            approvedByUser: { select: { id: true, name: true, email: true } },
          },
        });

        if (!claim) {
          return res.status(404).json({ message: 'Expense claim not found' });
        }

        // Non-admin users can only see their own
        if (claim.userId !== auth.sub && !['ADMIN', 'MANAGER'].includes(user.role)) {
          return res.status(403).json({ message: 'Forbidden' });
        }

        return res.status(200).json({ data: claim });
      }

      case 'PUT': {
        const existing = await prisma.expenseClaim.findFirst({
          where: { id, organizationId: orgId },
        });
        if (!existing) {
          return res.status(404).json({ message: 'Expense claim not found' });
        }

        if (existing.userId !== auth.sub) {
          return res.status(403).json({ message: 'You can only edit your own expense claims' });
        }

        if (existing.status !== 'DRAFT') {
          return res.status(400).json({ message: 'Only draft claims can be edited' });
        }

        const { title, description, items } = req.body;

        const claim = await prisma.$transaction(async (tx: any) => {
          if (items && Array.isArray(items)) {
            await tx.expenseItem.deleteMany({ where: { expenseClaimId: id } });

            const expenseItems = items.map((item: any) => {
              const amount = Number(item.amount);
              return {
                expenseClaimId: id,
                description: item.description,
                amount,
                category: item.category || null,
                date: item.date ? new Date(item.date) : new Date(),
                receiptUrl: item.receiptUrl || null,
              };
            });

            await tx.expenseItem.createMany({ data: expenseItems });

            const totalAmount = expenseItems.reduce((sum: number, item: any) => sum + item.amount, 0);

            return tx.expenseClaim.update({
              where: { id },
              data: {
                ...(title !== undefined && { title }),
                ...(description !== undefined && { description }),
                totalAmount,
              },
              include: {
                user: { select: { id: true, name: true, email: true } },
                items: true,
              },
            });
          }

          return tx.expenseClaim.update({
            where: { id },
            data: {
              ...(title !== undefined && { title }),
              ...(description !== undefined && { description }),
            },
            include: {
              user: { select: { id: true, name: true, email: true } },
              items: true,
            },
          });
        });

        return res.status(200).json({ data: claim });
      }

      case 'DELETE': {
        const existing = await prisma.expenseClaim.findFirst({
          where: { id, organizationId: orgId },
        });
        if (!existing) {
          return res.status(404).json({ message: 'Expense claim not found' });
        }

        if (existing.userId !== auth.sub && !['ADMIN'].includes(user.role)) {
          return res.status(403).json({ message: 'You can only delete your own expense claims' });
        }

        if (!['DRAFT', 'REJECTED'].includes(existing.status)) {
          return res.status(400).json({ message: 'Only draft or rejected claims can be deleted' });
        }

        await prisma.$transaction(async (tx: any) => {
          await tx.expenseItem.deleteMany({ where: { expenseClaimId: id } });
          await tx.expenseClaim.delete({ where: { id } });
        });

        return res.status(200).json({ message: 'Expense claim deleted' });
      }

      case 'PATCH': {
        const existing = await prisma.expenseClaim.findFirst({
          where: { id, organizationId: orgId },
          include: { items: true },
        });
        if (!existing) {
          return res.status(404).json({ message: 'Expense claim not found' });
        }

        const { action, rejectionReason } = req.body;

        if (action === 'submit') {
          if (existing.userId !== auth.sub) {
            return res.status(403).json({ message: 'You can only submit your own expense claims' });
          }
          if (existing.status !== 'DRAFT') {
            return res.status(400).json({ message: 'Only draft claims can be submitted' });
          }

          const claim = await prisma.expenseClaim.update({
            where: { id },
            data: { status: 'SUBMITTED', submittedAt: new Date() },
            include: {
              user: { select: { id: true, name: true, email: true } },
              items: true,
            },
          });

          return res.status(200).json({ data: claim });
        }

        if (action === 'approve') {
          if (!['ADMIN', 'MANAGER'].includes(user.role)) {
            return res.status(403).json({ message: 'Only admins and managers can approve claims' });
          }
          if (existing.status !== 'SUBMITTED') {
            return res.status(400).json({ message: 'Only submitted claims can be approved' });
          }
          if (existing.userId === auth.sub) {
            return res.status(400).json({ message: 'You cannot approve your own expense claim' });
          }

          const claim = await prisma.expenseClaim.update({
            where: { id },
            data: {
              status: 'APPROVED',
              approvedBy: auth.sub,
              approvedAt: new Date(),
            },
            include: {
              user: { select: { id: true, name: true, email: true } },
              items: true,
              approvedByUser: { select: { id: true, name: true, email: true } },
            },
          });

          return res.status(200).json({ data: claim });
        }

        if (action === 'reject') {
          if (!['ADMIN', 'MANAGER'].includes(user.role)) {
            return res.status(403).json({ message: 'Only admins and managers can reject claims' });
          }
          if (existing.status !== 'SUBMITTED') {
            return res.status(400).json({ message: 'Only submitted claims can be rejected' });
          }

          const claim = await prisma.expenseClaim.update({
            where: { id },
            data: {
              status: 'REJECTED',
              rejectionReason: rejectionReason || null,
              approvedBy: auth.sub,
              approvedAt: new Date(),
            },
            include: {
              user: { select: { id: true, name: true, email: true } },
              items: true,
            },
          });

          return res.status(200).json({ data: claim });
        }

        return res.status(400).json({
          message: 'Invalid action. Use "submit", "approve", or "reject"',
        });
      }

      default:
        return res.status(405).json({ message: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Expense [id] error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}
