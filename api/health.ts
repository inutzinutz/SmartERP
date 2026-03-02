import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // Test 1: Basic function works
    const info: Record<string, any> = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      node: process.version,
      env: {
        DATABASE_URL: process.env.DATABASE_URL ? 'SET (length: ' + process.env.DATABASE_URL.length + ')' : 'NOT SET',
        DIRECT_URL: process.env.DIRECT_URL ? 'SET' : 'NOT SET',
        JWT_SECRET: process.env.JWT_SECRET ? 'SET' : 'NOT SET',
      },
    };

    // Test 2: Can we import Prisma?
    try {
      const { PrismaClient } = require('@prisma/client');
      info.prismaImport = 'OK';

      // Test 3: Can we connect?
      const prisma = new PrismaClient();
      const result = await prisma.$queryRaw`SELECT 1 as test`;
      info.dbConnection = 'OK';
      info.dbResult = result;
      await prisma.$disconnect();
    } catch (prismaErr: any) {
      info.prismaError = prismaErr.message;
      info.prismaStack = prismaErr.stack?.split('\n').slice(0, 5);
    }

    return res.status(200).json(info);
  } catch (error: any) {
    return res.status(500).json({
      status: 'error',
      message: error.message,
      stack: error.stack?.split('\n').slice(0, 5),
    });
  }
}
