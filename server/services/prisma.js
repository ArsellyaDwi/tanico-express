import '../loadEnv.js';
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis;

if (!globalForPrisma.__expressPrisma) {
  globalForPrisma.__expressPrisma = new PrismaClient({
    log: ['error', 'warn'],
  });
}

export const prisma = globalForPrisma.__expressPrisma;
export default prisma;
