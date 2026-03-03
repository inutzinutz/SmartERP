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

  try {
    // Verify quotation belongs to org
    const quotation = await prisma.quotation.findFirst({
      where: { id, customer: { organizationId: orgId } },
      include: {
        customer: { select: { id: true, name: true, email: true, phone: true, address: true } },
        user: { select: { id: true, firstName: true, lastName: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, code: true, unit: true } },
          },
        },
      },
    });

    if (!quotation) {
      return res.status(404).json({ message: 'Quotation not found' });
    }

    switch (req.method) {
      case 'GET':
        return res.status(200).json(quotation);

      case 'PATCH': {
        const { action } = req.body;

        if (action === 'send') {
          if (quotation.status !== 'DRAFT') {
            return res.status(400).json({ message: 'Only draft quotations can be sent' });
          }
          const updated = await prisma.quotation.update({
            where: { id },
            data: { status: 'SENT' },
          });
          return res.status(200).json(updated);
        }

        if (action === 'accept') {
          if (!['DRAFT', 'SENT'].includes(quotation.status)) {
            return res.status(400).json({ message: 'Quotation cannot be accepted in current status' });
          }
          const updated = await prisma.quotation.update({
            where: { id },
            data: { status: 'ACCEPTED' },
          });
          return res.status(200).json(updated);
        }

        if (action === 'reject') {
          if (!['DRAFT', 'SENT'].includes(quotation.status)) {
            return res.status(400).json({ message: 'Quotation cannot be rejected in current status' });
          }
          const updated = await prisma.quotation.update({
            where: { id },
            data: { status: 'REJECTED' },
          });
          return res.status(200).json(updated);
        }

        if (action === 'convert') {
          // Convert quotation to sales order
          if (quotation.status !== 'ACCEPTED') {
            return res.status(400).json({ message: 'Only accepted quotations can be converted to sales orders' });
          }

          // Generate order number
          const lastOrder = await prisma.salesOrder.findFirst({
            where: { customer: { organizationId: orgId } },
            orderBy: { createdAt: 'desc' },
            select: { orderNumber: true },
          });

          let nextNum = 1;
          if (lastOrder?.orderNumber) {
            const match = lastOrder.orderNumber.match(/(\d+)$/);
            if (match) nextNum = parseInt(match[1]) + 1;
          }
          const orderNumber = `SO-${String(nextNum).padStart(6, '0')}`;

          const result = await prisma.$transaction(async (tx: any) => {
            // Create sales order from quotation
            const salesOrder = await tx.salesOrder.create({
              data: {
                orderNumber,
                customer: { connect: { id: quotation.customerId } },
                user: { connect: { id: auth.sub } },
                status: 'DRAFT',
                subtotal: quotation.subtotal,
                taxAmount: quotation.taxAmount,
                discountAmount: quotation.discountAmount,
                totalAmount: quotation.totalAmount,
                notes: `Converted from ${quotation.quoteNumber}. ${quotation.notes || ''}`.trim(),
                items: {
                  create: quotation.items.map((item: any) => ({
                    productId: item.productId,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    discount: item.discount,
                    taxRate: item.taxRate,
                    totalAmount: item.totalAmount,
                  })),
                },
              },
              include: {
                customer: { select: { id: true, name: true } },
                items: true,
              },
            });

            // Mark quotation as converted
            await tx.quotation.update({
              where: { id },
              data: { status: 'CONVERTED' },
            });

            return salesOrder;
          });

          return res.status(200).json({
            message: 'Quotation converted to sales order',
            salesOrder: result,
          });
        }

        return res.status(400).json({ message: 'Invalid action. Use: send, accept, reject, convert' });
      }

      case 'DELETE': {
        if (quotation.status !== 'DRAFT') {
          return res.status(400).json({ message: 'Only draft quotations can be deleted' });
        }
        await prisma.quotation.delete({ where: { id } });
        return res.status(200).json({ message: 'Quotation deleted' });
      }

      default:
        return res.status(405).json({ message: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Quotation detail error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}
