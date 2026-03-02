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
        const organization = await prisma.organization.findUnique({
          where: { id: orgId },
        });

        if (!organization) {
          return res.status(404).json({ message: 'Organization not found' });
        }

        return res.status(200).json({ data: organization });
      }

      case 'PUT': {
        const { name, address, phone, email, website, taxId, currency, timezone, locale } = req.body;

        const updateData: any = {};
        if (name !== undefined) updateData.name = name;
        if (address !== undefined) updateData.address = address;
        if (phone !== undefined) updateData.phone = phone;
        if (email !== undefined) updateData.email = email;
        if (website !== undefined) updateData.website = website;
        if (taxId !== undefined) updateData.taxId = taxId;
        if (currency !== undefined) updateData.currency = currency;
        if (timezone !== undefined) updateData.timezone = timezone;
        if (locale !== undefined) updateData.locale = locale;

        const organization = await prisma.organization.update({
          where: { id: orgId },
          data: updateData,
        });

        return res.status(200).json({ data: organization });
      }

      default:
        return res.status(405).json({ message: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Settings organization error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}
