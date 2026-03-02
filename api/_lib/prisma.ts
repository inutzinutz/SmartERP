import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

// In serverless environments, limit connections to prevent pool exhaustion
// Using Supabase connection pooler (pgbouncer) for efficient connection management
const dbUrl = process.env.DATABASE_URL || '';
const needsConnectionLimit = !dbUrl.includes('pgbouncer=true');
const connectionParams = needsConnectionLimit ? 'connection_limit=1&pool_timeout=10' : '';
const separator = connectionParams ? (dbUrl.includes('?') ? '&' : '?') : '';

const prisma = global.prisma || new PrismaClient({
  datasources: {
    db: {
      url: dbUrl + separator + connectionParams,
    },
  },
});

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}

export default prisma;
