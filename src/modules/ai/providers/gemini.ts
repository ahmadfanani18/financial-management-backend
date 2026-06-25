import OpenAI from 'openai';
import type { AIProvider, AIMessage, AIChatOptions, AIChatResponse } from './index.js';

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/';

export function createGeminiProvider(apiKey?: string): AIProvider {
  let client: OpenAI | null = null;
  
  function getClient(): OpenAI {
    if (!client) {
      client = new OpenAI({
        apiKey: apiKey || process.env.GEMINI_API_KEY,
        baseURL: GEMINI_BASE_URL,
      });
    }
    return client;
  }
  
  return {
    name: 'gemini',

    async chat(
      messages: AIMessage[],
      options?: AIChatOptions
    ): Promise<AIChatResponse> {
      const model = options?.model || 'gemini-2.0-flash';
      const maxTokens = options?.maxTokens || 4096;

      try {
        const response = await getClient().chat.completions.create({
          model,
          max_tokens: maxTokens,
          messages: messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        });

        if (!response.choices || response.choices.length === 0) {
          throw new Error('Unexpected response: no choices in Gemini response');
        }

        const choice = response.choices[0];
        const usage = response.usage;

        return {
          content: choice.message.content || '',
          tokensUsed: (usage?.prompt_tokens || 0) + (usage?.completion_tokens || 0),
          model: response.model,
        };
      } catch (error) {
        if (error instanceof Error) {
          throw new Error(`Gemini API error: ${error.message}`);
        }
        throw new Error('Gemini API error: unknown error');
      }
    },
  };
}
