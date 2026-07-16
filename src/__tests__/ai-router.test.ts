import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { randomBytes } from 'crypto';
import type { AIProvider, AIMessage } from '../modules/ai/providers/index.js';
import { encrypt, decrypt } from '../modules/ai/crypto.js';
import { prisma } from '../../config/prisma.js';
import { getApiKeysStatus } from '../modules/user/api-keys-service.js';

vi.mock('../modules/user/api-keys-service.js', () => ({
  getApiKeysStatus: vi.fn(),
}));

vi.mock('../../config/prisma.js', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('../modules/ai/providers/claude.js', () => ({
  createClaudeProvider: vi.fn(() => mockProvider('claude')),
}));

vi.mock('../modules/ai/providers/openai.js', () => ({
  createOpenAIProvider: vi.fn(() => mockProvider('openai')),
}));

vi.mock('../modules/ai/providers/gemini.js', () => ({
  createGeminiProvider: vi.fn(() => mockProvider('gemini')),
}));

const mockProvider = (name: string, failCount = 0): AIProvider => ({
  name,
  chat: vi.fn().mockImplementation(() => {
    if (failCount > 0) {
      return Promise.reject(new Error(`${name} failed`));
    }
    return Promise.resolve({
      content: `Response from ${name}`,
      tokensUsed: 100,
      model: `${name}-model`,
    });
  }),
});

const { classifyQuery, createRouter } = await import('../modules/ai/router.js');

describe('classifyQuery', () => {
  it('should classify simple queries', () => {
    expect(classifyQuery('berapa saldo saya')).toBe('simple');
    expect(classifyQuery('apa itu investasi')).toBe('simple');
    expect(classifyQuery('siapa saya')).toBe('simple');
    expect(classifyQuery('kapan gajian')).toBe('simple');
    expect(classifyQuery('show transactions')).toBe('simple');
    expect(classifyQuery('list accounts')).toBe('simple');
    expect(classifyQuery('tolong buatkan laporan')).toBe('simple');
    expect(classifyQuery('cek budget')).toBe('simple');
    expect(classifyQuery('lihat saldo')).toBe('simple');
  });

  it('should classify complex queries', () => {
    expect(classifyQuery('analisa mendalam portofolio saya')).toBe('complex');
    expect(classifyQuery('bandingkan investasi ini dengan yang lain')).toBe('complex');
    expect(classifyQuery('strategy investasi untuk masa depan')).toBe('complex');
    expect(classifyQuery('why should i invest in crypto')).toBe('complex');
    expect(classifyQuery('haruskah saya diversify portfolio')).toBe('complex');
    expect(classifyQuery('rekomendasikan cara optimize savings')).toBe('complex');
    expect(classifyQuery('risk assessment investasi saya')).toBe('complex');
    expect(classifyQuery('proyeksi keuangan 5 tahun ke depan')).toBe('complex');
  });

  it('should default to analysis for other queries', () => {
    expect(classifyQuery('jelaskan soal inflasi')).toBe('analysis');
    expect(classifyQuery('bagaimana cara menabung')).toBe('analysis');
    expect(classifyQuery('tips keuangan')).toBe('analysis');
    expect(classifyQuery('evaluasi bulan ini')).toBe('analysis');
  });
});

describe('createRouter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should route simple queries to gemini first', async () => {
    const router = createRouter({});

    const messages: AIMessage[] = [{ role: 'user', content: 'berapa saldo' }];
    const result = await router.route(messages, 'simple');

    expect(result.provider).toBe('gemini');
    expect(result.content).toBe('Response from gemini');
  });

  it('should route analysis queries to claude first', async () => {
    const router = createRouter({});

    const messages: AIMessage[] = [{ role: 'user', content: 'evaluasi keuangan' }];
    const result = await router.route(messages, 'analysis');

    expect(result.provider).toBe('claude');
    expect(result.content).toBe('Response from claude');
  });

  it('should route complex queries to claude first', async () => {
    const router = createRouter({});

    const messages: AIMessage[] = [{ role: 'user', content: 'analisa mendalam' }];
    const result = await router.route(messages, 'complex');

    expect(result.provider).toBe('claude');
    expect(result.content).toBe('Response from claude');
  });

  it('should classify using classify method', () => {
    const router = createRouter({});
    expect(router.classify('berapa saldo')).toBe('simple');
    expect(router.classify('analisa mendalam')).toBe('complex');
    expect(router.classify('jelaskan soal pajak')).toBe('analysis');
  });
});

describe('User API Key Integration', () => {
  beforeAll(() => {
    process.env.ENCRYPTION_KEY = randomBytes(32).toString('base64');
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should encrypt and decrypt user API key correctly', () => {
    const testKey = 'sk-user-test-key-12345';
    const encrypted = encrypt(testKey);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(testKey);
  });

  it('should detect when user has no API keys configured', async () => {
    vi.mocked(getApiKeysStatus).mockResolvedValue({
      hasAnyKey: false,
      configuredProviders: [],
      primaryProvider: null,
    });

    const status = await getApiKeysStatus('user-id');
    expect(status.hasAnyKey).toBe(false);
    expect(status.configuredProviders).toEqual([]);
  });

  it('should detect when user has API keys configured', async () => {
    vi.mocked(getApiKeysStatus).mockResolvedValue({
      hasAnyKey: true,
      configuredProviders: ['gemini'],
      primaryProvider: 'gemini',
    });

    const status = await getApiKeysStatus('user-id');
    expect(status.hasAnyKey).toBe(true);
    expect(status.configuredProviders).toEqual(['gemini']);
    expect(status.primaryProvider).toBe('gemini');
  });
});
