import { describe, it, expect, beforeAll } from 'vitest';
import { randomBytes } from 'crypto';
import { encrypt, decrypt, isEncrypted } from '../modules/ai/crypto.js';

describe('AI Crypto', () => {
  const testKey = randomBytes(32).toString('base64');
  
  beforeAll(() => {
    process.env.ENCRYPTION_KEY = testKey;
  });

  it('should encrypt and decrypt correctly', () => {
    const plaintext = 'sk-test-api-key-12345';
    const encrypted = encrypt(plaintext);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it('should produce different ciphertexts for same plaintext', () => {
    const plaintext = 'same-text';
    const enc1 = encrypt(plaintext);
    const enc2 = encrypt(plaintext);
    expect(enc1).not.toBe(enc2);
  });

  it('should detect encrypted values correctly', () => {
    expect(isEncrypted('abc:def:ghi')).toBe(true);
    expect(isEncrypted('plain-text')).toBe(false);
    expect(isEncrypted(null)).toBe(false);
    expect(isEncrypted(undefined)).toBe(false);
  });

  it('should throw if ENCRYPTION_KEY not set', () => {
    delete process.env.ENCRYPTION_KEY;
    expect(() => encrypt('test')).toThrow('ENCRYPTION_KEY');
  });
});
