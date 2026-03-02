import type { VercelRequest, VercelResponse } from '@vercel/node';
import dns from 'dns';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const info: Record<string, any> = {
    status: 'ok',
    version: '5',
    timestamp: new Date().toISOString(),
  };

  const projectRef = 'hlplnckcqsmcbauuerrr';
  const password = 'Sine140430134508';
  const host = `db.${projectRef}.supabase.co`;

  // 1. DNS resolution check
  try {
    const addresses4 = await new Promise<string[]>((resolve, reject) => {
      dns.resolve4(host, (err, addresses) => err ? reject(err) : resolve(addresses));
    }).catch(() => []);
    
    const addresses6 = await new Promise<string[]>((resolve, reject) => {
      dns.resolve6(host, (err, addresses) => err ? reject(err) : resolve(addresses));
    }).catch(() => []);

    info.dns = {
      host,
      ipv4: addresses4,
      ipv6: addresses6,
      hasIPv4: addresses4.length > 0,
      hasIPv6: addresses6.length > 0,
    };
  } catch (err: any) {
    info.dnsError = err.message;
  }

  // 2. Try direct connection (both with and without IPv4/IPv6)
  const { PrismaClient } = require('@prisma/client');
  const results: Record<string, string> = {};

  // Direct connection (standard)
  try {
    const url = `postgresql://postgres:${password}@${host}:5432/postgres?connect_timeout=10`;
    const p = new PrismaClient({ datasources: { db: { url } } });
    await p.$queryRaw`SELECT 1 as test`;
    results['direct'] = 'SUCCESS';
    info.working = 'direct';
    await p.$disconnect();
  } catch (err: any) {
    results['direct'] = err.message?.substring(0, 150) ?? 'error';
  }

  // Try with sslmode
  try {
    const url = `postgresql://postgres:${password}@${host}:5432/postgres?sslmode=require&connect_timeout=10`;
    const p = new PrismaClient({ datasources: { db: { url } } });
    await p.$queryRaw`SELECT 1 as test`;
    results['direct-ssl'] = 'SUCCESS';
    info.working = 'direct-ssl';
    await p.$disconnect();
  } catch (err: any) {
    results['direct-ssl'] = err.message?.substring(0, 150) ?? 'error';
  }

  // Try IPv4 add-on host (Supabase paid feature)
  try {
    const ipv4Host = `${projectRef}.supabase.co`;
    const url = `postgresql://postgres:${password}@${ipv4Host}:5432/postgres?connect_timeout=10`;
    const p = new PrismaClient({ datasources: { db: { url } } });
    await p.$queryRaw`SELECT 1 as test`;
    results['ipv4-host'] = 'SUCCESS';
    info.working = 'ipv4-host';
    await p.$disconnect();
  } catch (err: any) {
    results['ipv4-host'] = err.message?.substring(0, 150) ?? 'error';
  }

  // Try port 6543 on the direct host (old pooler)
  try {
    const url = `postgresql://postgres:${password}@${host}:6543/postgres?pgbouncer=true&connect_timeout=10`;
    const p = new PrismaClient({ datasources: { db: { url } } });
    await p.$queryRaw`SELECT 1 as test`;
    results['direct-6543'] = 'SUCCESS';
    info.working = 'direct-6543';
    await p.$disconnect();
  } catch (err: any) {
    results['direct-6543'] = err.message?.substring(0, 150) ?? 'error';
  }

  info.results = results;
  return res.status(200).json(info);
}
