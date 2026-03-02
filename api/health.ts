import type { VercelRequest, VercelResponse } from '@vercel/node';
import prisma from './_lib/prisma';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const info: Record<string, any> = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  };

  try {
    await prisma.$queryRaw`SELECT 1 as test`;
    info.database = 'connected';
  } catch (err: any) {
    info.database = 'error';
    info.error = err.message?.substring(0, 200);
  }

  return res.status(info.database === 'connected' ? 200 : 503).json(info);
}
