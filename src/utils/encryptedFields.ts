import { Prisma } from '@prisma/client'
import { encrypt, decrypt } from './encryption'

const MONEY_FIELDS: Record<string, string[]> = {
  Account: ['balance'],
  Transaction: ['amount', 'adminFee'],
  Budget: ['amount', 'spent'],
  Goal: ['targetAmount', 'currentAmount', 'initialBalance'],
  GoalContribution: ['amount'],
  PlanMilestone: ['targetAmount'],
  Payment: ['amount', 'finalAmount'],
}

export const encryptionMiddleware: Prisma.Middleware = async (params, next) => {
  const model = params.model as string
  const fields = MONEY_FIELDS[model]

  if (fields && isWriteAction(params.action)) {
    if (params.action === 'upsert') {
      params.args.update = encryptFields(params.args.update, fields)
      params.args.create = encryptFields(params.args.create, fields)
    } else {
      params.args.data = encryptFields(params.args.data, fields)
    }
  }

  const result = await next(params)

  if (fields && isReadAction(params.action)) {
    return decryptFields(result, fields)
  }

  return result
}

function isWriteAction(action: string): boolean {
  return ['create', 'update', 'createMany', 'updateMany', 'upsert'].includes(action)
}

function isReadAction(action: string): boolean {
  return ['findUnique', 'findFirst', 'findMany', 'create'].includes(action)
}

function encryptFields(data: unknown, fields: string[]): unknown {
  if (!data || typeof data !== 'object') return data

  if (Array.isArray(data)) {
    return data.map(item => encryptFields(item, fields))
  }

  const result = { ...data as Record<string, unknown> }

  for (const field of fields) {
    if (field in result) {
      const value = result[field]
      if (value === null || value === undefined) continue

      if (typeof value === 'string' && value.startsWith('$enc$')) continue

      const plainText = typeof value === 'object' && 'toString' in value
        ? (value as { toString: () => string }).toString()
        : String(value)

      result[field] = encrypt(plainText)
    }
  }

  return result
}

function decryptFields(data: unknown, fields: string[]): unknown {
  if (!data) return data

  if (Array.isArray(data)) {
    return data.map(item => decryptFields(item, fields))
  }

  if (typeof data !== 'object') return data

  const result = { ...data as Record<string, unknown> }

  for (const field of fields) {
    if (field in result) {
      const value = result[field]
      if (value === null || value === undefined) continue
      if (typeof value !== 'string') {
        result[field] = String(value)
        continue
      }
      if (value.startsWith('$enc$')) {
        try {
          result[field] = decrypt(value)
        } catch (err) {
          console.error(`Failed to decrypt field ${field}:`, err)
          result[field] = null
        }
      }
    }
  }

  return result
}
