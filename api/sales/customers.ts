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
        const tier = req.query.tier as string;
        const sortBy = (req.query.sortBy as string) || 'name';
        const sortOrder = (req.query.sortOrder as string) === 'desc' ? 'desc' : 'asc';

        const where: any = { organizationId: orgId };

        if (tier) where.tier = tier;

        if (search) {
          where.OR = [
            { name: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
            { phone: { contains: search, mode: 'insensitive' } },
            { code: { contains: search, mode: 'insensitive' } },
          ];
        }

        const [data, total] = await Promise.all([
          prisma.customer.findMany({
            where,
            include: {
              _count: { select: { salesOrders: true } },
            },
            orderBy: { [sortBy]: sortOrder },
            skip: (page - 1) * limit,
            take: limit,
          }),
          prisma.customer.count({ where }),
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
        const { name, email, phone, address, taxId, code, tier, creditLimit } = req.body;

        if (!name) {
          return res.status(400).json({ message: 'Customer name is required' });
        }

        if (email) {
          const existing = await prisma.customer.findFirst({
            where: { organizationId: orgId, email },
          });
          if (existing) {
            return res.status(409).json({ message: 'A customer with this email already exists' });
          }
        }

        const customer = await prisma.customer.create({
          data: {
            organization: { connect: { id: orgId } },
            name,
            email: email || null,
            phone: phone || null,
            address: address || null,
            taxId: taxId || null,
            code: code || 'CUST-' + Date.now(),
            tier: tier || 'STANDARD',
            creditLimit: creditLimit ?? 0,
          },
        });

        return res.status(201).json({ data: customer });
      }

      default:
        return res.status(405).json({ message: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Customers error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}
