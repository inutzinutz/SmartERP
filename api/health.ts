import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const info: Record<string, any> = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      node: process.version,
      env: {
        DATABASE_URL: process.env.DATABASE_URL ? 'SET (length: ' + process.env.DATABASE_URL.length + ', host: ' + (process.env.DATABASE_URL.match(/@([^:\/]+)/)?.[1] ?? 'unknown') + ')' : 'NOT SET',
        DIRECT_URL: process.env.DIRECT_URL ? 'SET' : 'NOT SET',
        JWT_SECRET: process.env.JWT_SECRET ? 'SET' : 'NOT SET',
      },
    };

    // Test Prisma connection
    try {
      const { PrismaClient } = require('@prisma/client');
      info.prismaImport = 'OK';

      const prisma = new PrismaClient({
        datasources: {
          db: { url: process.env.DATABASE_URL },
        },
      });
      const result = await prisma.$queryRaw`SELECT 1 as test`;
      info.dbConnection = 'OK';
      info.dbResult = result;
      await prisma.$disconnect();
    } catch (prismaErr: any) {
      info.prismaError = prismaErr.message?.substring(0, 500);
    }

    return res.status(200).json(info);
  } catch (error: any) {
    return res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
}
