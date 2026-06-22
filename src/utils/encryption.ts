import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16

function getKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY
  if (!key || key.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be 64 hex characters (32 bytes)')
  }
  return Buffer.from(key, 'hex')
}

export function encrypt(text: string): string {
  const key = getKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)

  let encrypted = cipher.update(text, 'utf8', 'base64')
  encrypted += cipher.final('base64')

  const authTag = cipher.getAuthTag()
  return `$enc$${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`
}

export function decrypt(encryptedData: string): string {
  if (!encryptedData.startsWith('$enc$')) {
    throw new Error('Invalid encrypted data format')
  }

  const data = encryptedData.slice(5)
  const [ivB64, authTagB64, ciphertext] = data.split(':')

  if (!ivB64 || !authTagB64 || !ciphertext) {
    throw new Error('Invalid encrypted data structure')
  }

  const key = getKey()
  const iv = Buffer.from(ivB64, 'base64')
  const authTag = Buffer.from(authTagB64, 'base64')

  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)

  let decrypted = decipher.update(ciphertext, 'base64', 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}