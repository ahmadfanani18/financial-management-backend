import { PrismaClient } from '@prisma/client'
import { encrypt } from '../src/utils/encryption'

const prisma = new PrismaClient()

const MODELS_WITH_MONEY = [
  { model: 'account', fields: ['balance'] },
  { model: 'transaction', fields: ['amount', 'adminFee'] },
  { model: 'budget', fields: ['amount', 'spent'] },
  { model: 'goal', fields: ['targetAmount', 'currentAmount', 'initialBalance'] },
  { model: 'goalContribution', fields: ['amount'] },
  { model: 'planMilestone', fields: ['targetAmount'] },
  { model: 'payment', fields: ['amount', 'finalAmount'] },
]

async function migrate() {
  console.log('Starting monetary data encryption migration...')

  for (const { model, fields } of MODELS_WITH_MONEY) {
    console.log(`\nProcessing ${model}...`)

    const records = await (prisma as any)[model].findMany({
      where: {
        [fields[0]]: { not: null },
      },
      select: { id: true, [fields[0]]: true },
    })

    console.log(`  Found ${records.length} records`)

    const batchSize = 100
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize)

      await Promise.all(
        batch.map(async (record: any) => {
          const updateData: any = { id: record.id }

          for (const field of fields) {
            const value = record[field]
            if (value !== null && value !== undefined) {
              const plainText = typeof value === 'object' && 'toString' in value
                ? value.toString()
                : String(value)
              updateData[field] = encrypt(plainText)
            }
          }

          await (prisma as any)[model].update({
            where: { id: record.id },
            data: updateData,
          })
        })
      )

      console.log(`  Encrypted batch ${i / batchSize + 1}/${Math.ceil(records.length / batchSize)}`)
    }

    console.log(`  Completed ${model}`)
  }

  console.log('\nMigration complete!')
}

migrate()
  .catch(console.error)
  .finally(() => prisma.$disconnect())