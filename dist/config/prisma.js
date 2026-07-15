import { PrismaClient } from '@prisma/client';
import { encryptionMiddleware } from '../utils/encryptedFields';
const globalForPrisma = globalThis;
export const prisma = globalForPrisma.prisma ?? new PrismaClient();
prisma.$use(encryptionMiddleware);
if (process.env.NODE_ENV !== 'production')
    globalForPrisma.prisma = prisma;
//# sourceMappingURL=prisma.js.map