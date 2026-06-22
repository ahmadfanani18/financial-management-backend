import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { encrypt, decrypt } from '../utils/encryption'

describe('encryption', () => {
  const originalEnv = process.env.ENCRYPTION_KEY

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = 'a'.repeat(64)
  })

  afterEach(() => {
    if (originalEnv) {
      process.env.ENCRYPTION_KEY = originalEnv
    }
  })

  it('encrypts and decrypts basic number', () => {
    const plain = '150000'
    const encrypted = encrypt(plain)
    expect(encrypted).toContain('$enc$')
    expect(encrypted).not.toBe(plain)
    expect(decrypt(encrypted)).toBe(plain)
  })

  it('encrypts decimal values correctly', () => {
    const plain = '150000.50'
    const encrypted = encrypt(plain)
    expect(decrypt(encrypted)).toBe(plain)
  })

  it('encrypts zero correctly', () => {
    const plain = '0'
    const encrypted = encrypt(plain)
    expect(decrypt(encrypted)).toBe(plain)
  })

  it('encrypts negative values correctly', () => {
    const plain = '-5000'
    const encrypted = encrypt(plain)
    expect(decrypt(encrypted)).toBe(plain)
  })

  it('throws on invalid format', () => {
    expect(() => decrypt('invalid')).toThrow('Invalid encrypted data format')
    expect(() => decrypt('plaintext')).toThrow('Invalid encrypted data format')
  })

  it('produces different ciphertext for same input (random IV)', () => {
    const plain = '150000'
    const enc1 = encrypt(plain)
    const enc2 = encrypt(plain)
    expect(enc1).not.toBe(enc2)
    expect(decrypt(enc1)).toBe(plain)
    expect(decrypt(enc2)).toBe(plain)
  })
})