import type { VercelRequest, VercelResponse } from '@vercel/node';
import prisma from './_lib/prisma';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const info: Record<string, any> = {
    status: 'ok',
    version: '3',
    timestamp: new Date().toISOString(),
    node: process.version,
    env: {
      DATABASE_URL: process.env.DATABASE_URL 
        ? `SET (len=${process.env.DATABASE_URL.length}, host=${new URL(process.env.DATABASE_URL).hostname})`
        : 'NOT SET',
      DIRECT_URL: process.env.DIRECT_URL ? 'SET' : 'NOT SET',
      JWT_SECRET: process.env.JWT_SECRET ? 'SET' : 'NOT SET',
    },
  };

  // Test with the shared prisma singleton (same as all API functions use)
  try {
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    info.dbConnection = 'OK';
    info.dbResult = result;
  } catch (err: any) {
    info.dbError = err.message?.substring(0, 300);
    info.dbErrorCode = err.code;
  }

  return res.status(200).json(info);
}
