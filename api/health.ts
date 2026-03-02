import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const info: Record<string, any> = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    node: process.version,
  };

  const regions = [
    'ap-southeast-1',
    'us-east-1',
    'ap-southeast-2',
    'ap-northeast-1',
    'eu-west-1',
    'eu-central-1',
    'us-west-1',
    'us-west-2',
  ];

  const password = process.env.DATABASE_URL?.match(/:([^@]+)@/)?.[1] ?? '';
  const projectRef = 'hlplnckcqsmcbauuerrr';
  info.passwordLen = password.length;

  // Test each region
  const results: Record<string, string> = {};
  const { PrismaClient } = require('@prisma/client');

  for (const region of regions) {
    const url = `postgresql://postgres.${projectRef}:${password}@aws-0-${region}.pooler.supabase.com:6543/postgres?pgbouncer=true&connect_timeout=5`;
    try {
      const prisma = new PrismaClient({
        datasources: { db: { url } },
      });
      await prisma.$queryRaw`SELECT 1 as test`;
      results[region] = 'OK';
      await prisma.$disconnect();
      info.workingRegion = region;
      info.workingUrl = url.replace(password, '***');
      break;
    } catch (err: any) {
      results[region] = err.message?.substring(0, 100) ?? 'Unknown error';
      try {
        // Try to disconnect even on error
      } catch {}
    }
  }

  // Also test the direct connection
  try {
    const directUrl = `postgresql://postgres:${password}@db.${projectRef}.supabase.co:5432/postgres`;
    const prisma = new PrismaClient({
      datasources: { db: { url: directUrl } },
    });
    await prisma.$queryRaw`SELECT 1 as test`;
    results['direct-5432'] = 'OK';
    info.directWorks = true;
    await prisma.$disconnect();
  } catch (err: any) {
    results['direct-5432'] = err.message?.substring(0, 100) ?? 'Unknown error';
  }

  info.regionResults = results;

  return res.status(200).json(info);
}
