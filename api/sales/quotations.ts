import type { VercelRequest, VercelResponse } from '@vercel/node';
import prisma from '../_lib/prisma';
import { getUserFromRequest } from '../_lib/auth';
import { cors } from '../_lib/cors';

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
        const customerId = req.query.customerId as string;

        const where: any = { customer: { organizationId: orgId } };

        if (status) where.status = status;
        if (customerId) where.customerId = customerId;

        if (search) {
          where.OR = [
            { quoteNumber: { contains: search, mode: 'insensitive' } },
            { customer: { name: { contains: search, mode: 'insensitive' } } },
          ];
        }

        const [data, total] = await Promise.all([
          prisma.quotation.findMany({
            where,
            include: {
              customer: { select: { id: true, name: true, email: true } },
              _count: { select: { items: true } },
            },
            orderBy: { createdAt: 'desc' },
            skip: (page - 1) * limit,
            take: limit,
          }),
          prisma.quotation.count({ where }),
        ]);

        return res.status(200).json({
          data,
          total,
          page,
          limit,
        });
      }

      case 'POST': {
        const { customerId, items, notes, terms, quoteDate, validUntil } = req.body;

        if (!customerId) {
          return res.status(400).json({ message: 'Customer ID is required' });
        }
        if (!items || !Array.isArray(items) || items.length === 0) {
          return res.status(400).json({ message: 'At least one item is required' });
        }

        // Verify customer belongs to org
        const customer = await prisma.customer.findFirst({
          where: { id: customerId, organizationId: orgId },
        });
        if (!customer) {
          return res.status(404).json({ message: 'Customer not found' });
        }

        // Verify products
        const productIds = items.map((i: any) => i.productId);
        const products = await prisma.product.findMany({
          where: { id: { in: productIds }, organizationId: orgId },
        });
        if (products.length !== productIds.length) {
          return res.status(400).json({ message: 'One or more products not found' });
        }

        const productMap = new Map(products.map((p) => [p.id, p]));

        // Calculate totals
        const quoteItems = items.map((item: any) => {
          const product = productMap.get(item.productId)!;
          const unitPrice = item.unitPrice ?? Number((product as any).sellingPrice ?? 0);
          const quantity = Number(item.quantity);
          const discount = Number(item.discount ?? 0);
          const taxRate = Number(item.taxRate ?? 0);
          const subtotal = quantity * unitPrice - discount;
          const taxAmount = subtotal * (taxRate / 100);
          const totalAmount = subtotal + taxAmount;

          return {
            productId: item.productId,
            quantity,
            unitPrice,
            discount,
            taxRate,
            totalAmount,
          };
        });

        const subtotal = quoteItems.reduce((sum: number, item: any) => sum + (item.quantity * item.unitPrice - item.discount), 0);
        const taxAmount = quoteItems.reduce((sum: number, item: any) => sum + ((item.quantity * item.unitPrice - item.discount) * item.taxRate / 100), 0);
        const totalAmount = subtotal + taxAmount;

        // Generate quote number
        const lastQuote = await prisma.quotation.findFirst({
          where: { customer: { organizationId: orgId } },
          orderBy: { createdAt: 'desc' },
          select: { quoteNumber: true },
        });

        let nextNum = 1;
        if (lastQuote?.quoteNumber) {
          const match = lastQuote.quoteNumber.match(/(\d+)$/);
          if (match) nextNum = parseInt(match[1]) + 1;
        }
        const quoteNumber = `QT-${String(nextNum).padStart(6, '0')}`;

        const quotation = await prisma.quotation.create({
          data: {
            quoteNumber,
            customer: { connect: { id: customerId } },
            user: { connect: { id: auth.sub } },
            status: 'DRAFT',
            quoteDate: quoteDate ? new Date(quoteDate) : new Date(),
            validUntil: validUntil ? new Date(validUntil) : null,
            subtotal,
            taxAmount,
            totalAmount,
            notes: notes || null,
            terms: terms || null,
            items: {
              create: quoteItems,
            },
          },
          include: {
            customer: { select: { id: true, name: true } },
            items: {
              include: {
                product: { select: { id: true, name: true, code: true } },
              },
            },
          },
        });

        return res.status(201).json(quotation);
      }

      default:
        return res.status(405).json({ message: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Quotations error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}
