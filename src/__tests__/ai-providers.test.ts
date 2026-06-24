import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: class Anthropic {
      messages = {
        create: vi.fn().mockResolvedValue({
          content: [{ type: 'text', text: 'Claude response' }],
          usage: { input_tokens: 10, output_tokens: 20 },
          model: 'claude-sonnet-4-20250514',
        }),
      };
    },
  };
});

vi.mock('openai', () => {
  return {
    default: class OpenAI {
      chat = {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{ message: { content: 'OpenAI response' } }],
            usage: { prompt_tokens: 15, completion_tokens: 25 },
            model: 'gpt-4o-mini',
          }),
        },
      };
    },
  };
});

import { createClaudeProvider } from '../modules/ai/providers/claude.js';
import { createOpenAIProvider } from '../modules/ai/providers/openai.js';
import { createGeminiProvider } from '../modules/ai/providers/gemini.js';

describe('AI Providers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Claude Provider', () => {
    it('should have correct name', () => {
      const provider = createClaudeProvider();
      expect(provider.name).toBe('claude');
    });

    it('should return chat response with required fields', async () => {
      const provider = createClaudeProvider();
      const response = await provider.chat([{ role: 'user', content: 'Hello' }]);

      expect(response).toHaveProperty('content');
      expect(response).toHaveProperty('tokensUsed');
      expect(response).toHaveProperty('model');
      expect(typeof response.content).toBe('string');
      expect(typeof response.tokensUsed).toBe('number');
    });
  });

  describe('OpenAI Provider', () => {
    it('should have correct name', () => {
      const provider = createOpenAIProvider();
      expect(provider.name).toBe('openai');
    });

    it('should return chat response with required fields', async () => {
      const provider = createOpenAIProvider();
      const response = await provider.chat([{ role: 'user', content: 'Hello' }]);

      expect(response).toHaveProperty('content');
      expect(response).toHaveProperty('tokensUsed');
      expect(response).toHaveProperty('model');
      expect(typeof response.content).toBe('string');
      expect(typeof response.tokensUsed).toBe('number');
    });
  });

  describe('Gemini Provider', () => {
    it('should have correct name', () => {
      const provider = createGeminiProvider('test-api-key');
      expect(provider.name).toBe('gemini');
    });

    it('should return chat response with required fields', async () => {
      const provider = createGeminiProvider('test-api-key');
      const response = await provider.chat([{ role: 'user', content: 'Hello' }]);

      expect(response).toHaveProperty('content');
      expect(response).toHaveProperty('tokensUsed');
      expect(response).toHaveProperty('model');
      expect(typeof response.content).toBe('string');
      expect(typeof response.tokensUsed).toBe('number');
    });
  });
});
