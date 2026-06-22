import { PrismaClient } from '@prisma/client'
import { encrypt } from '../src/utils/encryption'
import { Prisma } from '@prisma/client'

const prisma = new PrismaClient()

async function migrateAccount() {
  const records = await prisma.$queryRaw<{ id: string; balance: string }[]>`
    SELECT id, balance FROM "Account" WHERE balance IS NOT NULL
  `

  console.log(`  Found ${records.length} records`)

  for (const record of records) {
    const strValue = String(record.balance)
    if (!strValue.startsWith('$enc$')) {
      await prisma.$executeRaw`
        UPDATE "Account" SET balance = ${encrypt(strValue)} WHERE id = ${record.id}
      `
    }
  }
  console.log('  Done')
}

async function migrateTransaction() {
  const records = await prisma.$queryRaw<{ id: string; amount: string; adminFee: string }[]>`
    SELECT id, amount, "adminFee" FROM "Transaction" WHERE amount IS NOT NULL OR "adminFee" IS NOT NULL
  `

  console.log(`  Found ${records.length} records`)

  for (const record of records) {
    const updateParts: string[] = []
    if (record.amount && !String(record.amount).startsWith('$enc$')) {
      await prisma.$executeRaw`
        UPDATE "Transaction" SET amount = ${encrypt(String(record.amount))} WHERE id = ${record.id}
      `
    }
    if (record.adminFee && !String(record.adminFee).startsWith('$enc$')) {
      await prisma.$executeRaw`
        UPDATE "Transaction" SET "adminFee" = ${encrypt(String(record.adminFee))} WHERE id = ${record.id}
      `
    }
  }
  console.log('  Done')
}

async function migrateBudget() {
  const records = await prisma.$queryRaw<{ id: string; amount: string; spent: string }[]>`
    SELECT id, amount, spent FROM "Budget" WHERE amount IS NOT NULL OR spent IS NOT NULL
  `

  console.log(`  Found ${records.length} records`)

  for (const record of records) {
    if (record.amount && !String(record.amount).startsWith('$enc$')) {
      await prisma.$executeRaw`
        UPDATE "Budget" SET amount = ${encrypt(String(record.amount))} WHERE id = ${record.id}
      `
    }
    if (record.spent && !String(record.spent).startsWith('$enc$')) {
      await prisma.$executeRaw`
        UPDATE "Budget" SET spent = ${encrypt(String(record.spent))} WHERE id = ${record.id}
      `
    }
  }
  console.log('  Done')
}

async function migrateGoal() {
  const records = await prisma.$queryRaw<{ id: string; targetAmount: string; currentAmount: string; initialBalance: string }[]>`
    SELECT id, "targetAmount", "currentAmount", "initialBalance" FROM "Goal" WHERE "targetAmount" IS NOT NULL OR "currentAmount" IS NOT NULL OR "initialBalance" IS NOT NULL
  `

  console.log(`  Found ${records.length} records`)

  for (const record of records) {
    if (record.targetAmount && !String(record.targetAmount).startsWith('$enc$')) {
      await prisma.$executeRaw`
        UPDATE "Goal" SET "targetAmount" = ${encrypt(String(record.targetAmount))} WHERE id = ${record.id}
      `
    }
    if (record.currentAmount && !String(record.currentAmount).startsWith('$enc$')) {
      await prisma.$executeRaw`
        UPDATE "Goal" SET "currentAmount" = ${encrypt(String(record.currentAmount))} WHERE id = ${record.id}
      `
    }
    if (record.initialBalance && !String(record.initialBalance).startsWith('$enc$')) {
      await prisma.$executeRaw`
        UPDATE "Goal" SET "initialBalance" = ${encrypt(String(record.initialBalance))} WHERE id = ${record.id}
      `
    }
  }
  console.log('  Done')
}

async function migrateGoalContribution() {
  const records = await prisma.$queryRaw<{ id: string; amount: string }[]>`
    SELECT id, amount FROM "GoalContribution" WHERE amount IS NOT NULL
  `

  console.log(`  Found ${records.length} records`)

  for (const record of records) {
    const strValue = String(record.amount)
    if (!strValue.startsWith('$enc$')) {
      await prisma.$executeRaw`
        UPDATE "GoalContribution" SET amount = ${encrypt(strValue)} WHERE id = ${record.id}
      `
    }
  }
  console.log('  Done')
}

async function migratePlanMilestone() {
  const records = await prisma.$queryRaw<{ id: string; targetAmount: string }[]>`
    SELECT id, "targetAmount" FROM "PlanMilestone" WHERE "targetAmount" IS NOT NULL
  `

  console.log(`  Found ${records.length} records`)

  for (const record of records) {
    const strValue = String(record.targetAmount)
    if (!strValue.startsWith('$enc$')) {
      await prisma.$executeRaw`
        UPDATE "PlanMilestone" SET "targetAmount" = ${encrypt(strValue)} WHERE id = ${record.id}
      `
    }
  }
  console.log('  Done')
}

async function migratePayment() {
  const records = await prisma.$queryRaw<{ id: string; amount: string; finalAmount: string }[]>`
    SELECT id, amount, "finalAmount" FROM "Payment" WHERE amount IS NOT NULL OR "finalAmount" IS NOT NULL
  `

  console.log(`  Found ${records.length} records`)

  for (const record of records) {
    if (record.amount && !String(record.amount).startsWith('$enc$')) {
      await prisma.$executeRaw`
        UPDATE "Payment" SET amount = ${encrypt(String(record.amount))} WHERE id = ${record.id}
      `
    }
    if (record.finalAmount && !String(record.finalAmount).startsWith('$enc$')) {
      await prisma.$executeRaw`
        UPDATE "Payment" SET "finalAmount" = ${encrypt(String(record.finalAmount))} WHERE id = ${record.id}
      `
    }
  }
  console.log('  Done')
}

async function migrate() {
  console.log('Starting monetary data encryption migration...')

  console.log('\nProcessing Account...')
  await migrateAccount()

  console.log('\nProcessing Transaction...')
  await migrateTransaction()

  console.log('\nProcessing Budget...')
  await migrateBudget()

  console.log('\nProcessing Goal...')
  await migrateGoal()

  console.log('\nProcessing GoalContribution...')
  await migrateGoalContribution()

  console.log('\nProcessing PlanMilestone...')
  await migratePlanMilestone()

  console.log('\nProcessing Payment...')
  await migratePayment()

  console.log('\nMigration complete!')
}

migrate()
  .catch(console.error)
  .finally(() => prisma.$disconnect())