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
        const supplierId = req.query.supplierId as string;
        const sortBy = (req.query.sortBy as string) || 'createdAt';
        const sortOrder = (req.query.sortOrder as string) === 'asc' ? 'asc' : 'desc';

        const where: any = { organizationId: orgId };

        if (status) where.status = status;
        if (supplierId) where.supplierId = supplierId;

        if (search) {
          where.OR = [
            { orderNumber: { contains: search, mode: 'insensitive' } },
            { supplier: { name: { contains: search, mode: 'insensitive' } } },
          ];
        }

        const [data, total] = await Promise.all([
          prisma.purchaseOrder.findMany({
            where,
            include: {
              supplier: { select: { id: true, name: true, email: true } },
              _count: { select: { items: true } },
            },
            orderBy: { [sortBy]: sortOrder },
            skip: (page - 1) * limit,
            take: limit,
          }),
          prisma.purchaseOrder.count({ where }),
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
        const { supplierId, items, notes, expectedDate } = req.body;

        if (!supplierId) {
          return res.status(400).json({ message: 'Supplier ID is required' });
        }
        if (!items || !Array.isArray(items) || items.length === 0) {
          return res.status(400).json({ message: 'At least one order item is required' });
        }

        const supplier = await prisma.supplier.findFirst({
          where: { id: supplierId, organizationId: orgId },
        });
        if (!supplier) {
          return res.status(404).json({ message: 'Supplier not found' });
        }

        const productIds = items.map((i: any) => i.productId);
        const products = await prisma.product.findMany({
          where: { id: { in: productIds }, organizationId: orgId },
        });

        if (products.length !== productIds.length) {
          return res.status(400).json({ message: 'One or more products not found' });
        }

        const productMap = new Map(products.map((p) => [p.id, p]));

        const orderItems = items.map((item: any) => {
          const product = productMap.get(item.productId)!;
          const unitPrice = item.unitPrice ?? ((product as any).costPrice?.toNumber?.() ?? Number((product as any).costPrice ?? 0));
          const quantity = Number(item.quantity);
          const totalPrice = quantity * unitPrice;

          return {
            productId: item.productId,
            quantity,
            unitPrice,
            totalPrice,
          };
        });

        const totalAmount = orderItems.reduce((sum: number, item: any) => sum + item.totalPrice, 0);

        // Generate order number
        const lastOrder = await prisma.purchaseOrder.findFirst({
          where: { organizationId: orgId },
          orderBy: { createdAt: 'desc' },
          select: { orderNumber: true },
        });

        let nextNum = 1;
        if (lastOrder?.orderNumber) {
          const match = lastOrder.orderNumber.match(/(\d+)$/);
          if (match) nextNum = parseInt(match[1]) + 1;
        }
        const orderNumber = `PO-${String(nextNum).padStart(6, '0')}`;

        const order = await prisma.$transaction(async (tx: any) => {
          const purchaseOrder = await tx.purchaseOrder.create({
            data: {
              organizationId: orgId,
              orderNumber,
              supplierId,
              status: 'DRAFT',
              totalAmount,
              notes: notes || null,
              expectedDate: expectedDate ? new Date(expectedDate) : null,
              createdBy: auth.sub,
              items: {
                create: orderItems,
              },
            },
            include: {
              supplier: { select: { id: true, name: true } },
              items: {
                include: {
                  product: { select: { id: true, name: true, sku: true } },
                },
              },
            },
          });

          return purchaseOrder;
        });

        return res.status(201).json({ data: order });
      }

      default:
        return res.status(405).json({ message: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Purchase orders error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}
