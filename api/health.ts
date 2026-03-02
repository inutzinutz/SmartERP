import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const info: Record<string, any> = {
    status: 'ok',
    version: '4',
    timestamp: new Date().toISOString(),
  };

  const projectRef = 'hlplnckcqsmcbauuerrr';
  const password = 'Sine140430134508';
  
  // Try to find the correct region
  const regions = [
    'ap-southeast-1', 'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
    'ap-southeast-2', 'ap-northeast-1', 'ap-northeast-2', 'ap-south-1',
    'eu-west-1', 'eu-west-2', 'eu-west-3', 'eu-central-1', 'eu-central-2',
    'ca-central-1', 'sa-east-1',
  ];

  const { PrismaClient } = require('@prisma/client');
  const results: Record<string, string> = {};
  
  // Test each region sequentially (stop on first success)
  for (const region of regions) {
    const url = `postgresql://postgres.${projectRef}:${password}@aws-0-${region}.pooler.supabase.com:6543/postgres?pgbouncer=true&connect_timeout=5`;
    try {
      const p = new PrismaClient({ datasources: { db: { url } } });
      const r = await p.$queryRaw`SELECT 1 as test`;
      results[region] = 'SUCCESS';
      info.workingRegion = region;
      info.workingUrl = url.replace(password, '***');
      await p.$disconnect();
      break;
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.includes('Tenant or user not found')) {
        results[region] = 'WRONG_REGION';
      } else if (msg.includes("Can't reach")) {
        results[region] = 'UNREACHABLE';
      } else {
        results[region] = msg.substring(0, 80);
      }
    }
  }

  // Also try Session mode (port 5432 on pooler)
  try {
    const url = `postgresql://postgres.${projectRef}:${password}@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres?connect_timeout=5`;
    const p = new PrismaClient({ datasources: { db: { url } } });
    await p.$queryRaw`SELECT 1 as test`;
    results['session-mode-ap-se-1'] = 'SUCCESS';
    await p.$disconnect();
  } catch (err: any) {
    results['session-mode-ap-se-1'] = err.message?.includes('Tenant') ? 'WRONG_REGION' : (err.message?.substring(0, 80) ?? 'error');
  }

  info.regionResults = results;
  return res.status(200).json(info);
}
