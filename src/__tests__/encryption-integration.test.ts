import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '../config/prisma'

describe('encryption integration', () => {
  const testUserId = 'encryption-test-user'
  const testAccountId = 'encryption-test-account'

  beforeAll(async () => {
    await prisma.user.upsert({
      where: { id: testUserId },
      update: {},
      create: {
        id: testUserId,
        email: 'encryption-test@example.com',
        name: 'Encryption Test',
      },
    })

    await prisma.account.upsert({
      where: { id: testAccountId },
      update: {},
      create: {
        id: testAccountId,
        userId: testUserId,
        name: 'Test Account',
        type: 'BANK',
        balance: '0',
      },
    })
  })

  afterAll(async () => {
    await prisma.transaction.deleteMany({ where: { userId: testUserId } })
    await prisma.account.delete({ where: { id: testAccountId } })
    await prisma.user.delete({ where: { id: testUserId } })
  })

  it('encrypts and decrypts transaction amount', async () => {
    const testAmount = '50000'

    const transaction = await prisma.transaction.create({
      data: {
        userId: testUserId,
        accountId: testAccountId,
        type: 'EXPENSE',
        amount: testAmount,
        description: 'Test transaction',
        date: new Date(),
      },
    })

    expect(transaction.amount).toBe(testAmount)

    const found = await prisma.transaction.findUnique({
      where: { id: transaction.id },
    })

    expect(found?.amount).toBe(testAmount)
  })
})