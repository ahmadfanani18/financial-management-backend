import OpenAI from 'openai';
import type { AIProvider, AIMessage, AIChatOptions, AIChatResponse } from './index.js';

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/';

export function createGeminiProvider(apiKey: string): AIProvider {
  const client = new OpenAI({
    apiKey,
    baseURL: GEMINI_BASE_URL,
  });

  return {
    name: 'gemini',

    async chat(
      messages: AIMessage[],
      options?: AIChatOptions
    ): Promise<AIChatResponse> {
      const model = options?.model || 'gemini-2.0-flash';
      const maxTokens = options?.maxTokens || 4096;

      const response = await client.chat.completions.create({
        model,
        max_tokens: maxTokens,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      });

      const choice = response.choices[0];
      const usage = response.usage;

      return {
        content: choice.message.content || '',
        tokensUsed: (usage?.prompt_tokens || 0) + (usage?.completion_tokens || 0),
        model: response.model,
      };
    },
  };
}
