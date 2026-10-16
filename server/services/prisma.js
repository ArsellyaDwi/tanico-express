import '../loadEnv.js';
import { PrismaClient } from '@prisma/client';

if (!process.env.DATABASE_URL || process.env.DATABASE_URL.trim() === '') {
  process.env.DATABASE_URL = process.env.DIRECT_URL || 'postgresql://postgres:postgres@localhost:5432/tanico?schema=public';
}
if (!process.env.DIRECT_URL || process.env.DIRECT_URL.trim() === '') {
  process.env.DIRECT_URL = process.env.DATABASE_URL;
}

const globalForPrisma = globalThis;

function getPrismaClient() {
  if (!globalForPrisma.__expressPrisma) {
    try {
      globalForPrisma.__expressPrisma = new PrismaClient({
        log: ['error', 'warn'],
      });
    } catch (err) {
      console.warn('[Prisma] Initialization notice:', err?.message || err);
    }
  }
  return globalForPrisma.__expressPrisma;
}

let dbOfflineLogged = false;
function logDbNoticeOnce(err) {
  if (!dbOfflineLogged) {
    dbOfflineLogged = true;
    console.warn('[Prisma] Notice: Database is currently offline or unreachable. Returning safe fallback responses.');
  }
}

function createModelDelegateProxy(delegate, modelName) {
  return new Proxy(delegate || {}, {
    get(target, method) {
      const orig = target[method];
      if (typeof orig === 'function') {
        return async function (...args) {
          try {
            return await orig.apply(target, args);
          } catch (err) {
            const errName = err?.name || '';
            const errMsg = err?.message || '';
            const isConnectionError =
              errName === 'PrismaClientInitializationError' ||
              errName === 'PrismaClientRustPanicError' ||
              errMsg.includes("Can't reach database server") ||
              errMsg.includes('database server is not running') ||
              errMsg.includes('P1001') ||
              errMsg.includes('P1002') ||
              errMsg.includes('P1003');

            if (isConnectionError) {
              logDbNoticeOnce(err);
              if (method === 'findMany') return [];
              if (method === 'findFirst' || method === 'findUnique') return null;
              if (method === 'count') return 0;
              if (method === 'aggregate') return { _count: 0, _sum: {}, _avg: {}, _min: {}, _max: {} };
              if (method === 'create' || method === 'update' || method === 'upsert' || method === 'delete') {
                throw new Error(`Operasi ${modelName}.${String(method)} gagal: Database PostgreSQL sedang tidak terhubung.`);
              }
            }
            throw err;
          }
        };
      }
      return orig;
    }
  });
}

// Proxy that ensures Prisma is lazily initialized on demand and delegates are safely wrapped
export const prisma = new Proxy({}, {
  get(target, prop) {
    const client = getPrismaClient();
    if (!client) {
      console.warn(`[Prisma] Client not available when accessing '${String(prop)}', using safe fallback`);
      return {
        findMany: async () => [],
        findFirst: async () => null,
        findUnique: async () => null,
        count: async () => 0,
        create: async () => ({}),
        update: async () => ({}),
        delete: async () => ({}),
        upsert: async () => ({}),
      };
    }
    const val = client[prop];
    if (typeof val === 'function') {
      return val.bind(client);
    }
    if (val && typeof val === 'object') {
      return createModelDelegateProxy(val, String(prop));
    }
    if (val === undefined) {
      return {
        findMany: async () => [],
        findFirst: async () => null,
        findUnique: async () => null,
        count: async () => 0,
        create: async () => ({}),
        update: async () => ({}),
        delete: async () => ({}),
        upsert: async () => ({}),
      };
    }
    return val;
  }
});

export default prisma;

