import type { VercelRequest, VercelResponse } from '@vercel/node';
import prisma from '../../_lib/prisma';
import { getUserFromRequest } from '../../_lib/auth';
import { cors } from '../../_lib/cors';

interface AccountNode {
  id: string;
  code: string;
  name: string;
  type: string;
  parentId: string | null;
  isActive: boolean;
  description: string | null;
  children: AccountNode[];
}

function buildTree(accounts: any[]): AccountNode[] {
  const map = new Map<string, AccountNode>();
  const roots: AccountNode[] = [];

  for (const acc of accounts) {
    map.set(acc.id, { ...acc, children: [] });
  }

  for (const acc of accounts) {
    const node = map.get(acc.id)!;
    if (acc.parentId && map.has(acc.parentId)) {
      map.get(acc.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

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
        const flat = req.query.flat === 'true';
        const type = req.query.type as string;
        const search = (req.query.search as string) || '';
        const page = Math.max(1, parseInt(req.query.page as string) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 100));
        const sortBy = (req.query.sortBy as string) || 'code';
        const sortOrder = (req.query.sortOrder as string) === 'desc' ? 'desc' : 'asc';

        const where: any = { organizationId: orgId };

        if (type) where.type = type;

        if (search) {
          where.OR = [
            { name: { contains: search, mode: 'insensitive' } },
            { code: { contains: search, mode: 'insensitive' } },
          ];
        }

        if (flat) {
          const [data, total] = await Promise.all([
            prisma.account.findMany({
              where,
              orderBy: { [sortBy]: sortOrder },
              skip: (page - 1) * limit,
              take: limit,
            }),
            prisma.account.count({ where }),
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

        // Tree structure
        const accounts = await prisma.account.findMany({
          where: { organizationId: orgId, ...(type ? { type } : {}) },
          orderBy: { code: 'asc' },
        });

        const tree = buildTree(accounts);

        return res.status(200).json({ data: tree });
      }

      case 'POST': {
        const { code, name, type, parentId, description, isActive } = req.body;

        if (!code || !name || !type) {
          return res.status(400).json({ message: 'code, name, and type are required' });
        }

        const validTypes = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'];
        if (!validTypes.includes(type)) {
          return res.status(400).json({
            message: `Invalid account type. Must be one of: ${validTypes.join(', ')}`,
          });
        }

        const existing = await prisma.account.findFirst({
          where: { organizationId: orgId, code },
        });
        if (existing) {
          return res.status(409).json({ message: 'An account with this code already exists' });
        }

        if (parentId) {
          const parent = await prisma.account.findFirst({
            where: { id: parentId, organizationId: orgId },
          });
          if (!parent) {
            return res.status(404).json({ message: 'Parent account not found' });
          }
        }

        const account = await prisma.account.create({
          data: {
            organizationId: orgId,
            code,
            name,
            type,
            parentId: parentId || null,
            description: description || null,
            isActive: isActive !== false,
          },
        });

        return res.status(201).json({ data: account });
      }

      default:
        return res.status(405).json({ message: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Accounts error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}
