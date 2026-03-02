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
        const sortBy = (req.query.sortBy as string) || 'createdAt';
        const sortOrder = (req.query.sortOrder as string) === 'asc' ? 'asc' : 'desc';

        const where: any = { customer: { organizationId: orgId } };

        if (status) where.status = status;
        if (customerId) where.customerId = customerId;

        if (search) {
          where.OR = [
            { orderNumber: { contains: search, mode: 'insensitive' } },
            { customer: { name: { contains: search, mode: 'insensitive' } } },
          ];
        }

        const [data, total] = await Promise.all([
          prisma.salesOrder.findMany({
            where,
            include: {
              customer: { select: { id: true, name: true, email: true } },
              _count: { select: { items: true } },
            },
            orderBy: { [sortBy]: sortOrder },
            skip: (page - 1) * limit,
            take: limit,
          }),
          prisma.salesOrder.count({ where }),
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
        const { customerId, items, notes, orderDate } = req.body;

        if (!customerId) {
          return res.status(400).json({ message: 'Customer ID is required' });
        }
        if (!items || !Array.isArray(items) || items.length === 0) {
          return res.status(400).json({ message: 'At least one order item is required' });
        }

        // Verify customer belongs to org
        const customer = await prisma.customer.findFirst({
          where: { id: customerId, organizationId: orgId },
        });
        if (!customer) {
          return res.status(404).json({ message: 'Customer not found' });
        }

        // Verify all products exist and belong to org
        const productIds = items.map((i: any) => i.productId);
        const products = await prisma.product.findMany({
          where: { id: { in: productIds }, organizationId: orgId },
        });

        if (products.length !== productIds.length) {
          return res.status(400).json({ message: 'One or more products not found' });
        }

        const productMap = new Map(products.map((p) => [p.id, p]));

        // Calculate totals
        const orderItems = items.map((item: any) => {
          const product = productMap.get(item.productId)!;
          const unitPrice = item.unitPrice ?? ((product as any).sellingPrice?.toNumber?.() ?? Number((product as any).sellingPrice ?? 0));
          const quantity = Number(item.quantity);
          const discount = Number(item.discount ?? 0);
          const totalAmount = quantity * unitPrice - discount;

          return {
            productId: item.productId,
            quantity,
            unitPrice,
            discount,
            totalAmount,
          };
        });

        const totalOrderAmount = orderItems.reduce((sum: number, item: any) => sum + item.totalAmount, 0);

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

        const order = await prisma.$transaction(async (tx: any) => {
          const salesOrder = await tx.salesOrder.create({
            data: {
              orderNumber,
              customer: { connect: { id: customerId } },
              user: { connect: { id: auth.sub } },
              status: 'DRAFT',
              subtotal: totalOrderAmount,
              totalAmount: totalOrderAmount,
              notes: notes || null,
              orderDate: orderDate ? new Date(orderDate) : new Date(),
              items: {
                create: orderItems,
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

          return salesOrder;
        });

        return res.status(201).json({ data: order });
      }

      default:
        return res.status(405).json({ message: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Sales orders error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}
