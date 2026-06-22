import { PrismaClient } from '@prisma/client'
import { encryptionMiddleware } from '../utils/encryptedFields'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

prisma.$use(encryptionMiddleware)

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
