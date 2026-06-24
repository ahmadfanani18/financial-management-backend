import OpenAI from 'openai';
import type { AIProvider, AIMessage, AIChatOptions, AIChatResponse } from './index.js';

const openai = new OpenAI();

export function createOpenAIProvider(): AIProvider {
  return {
    name: 'openai',

    async chat(
      messages: AIMessage[],
      options?: AIChatOptions
    ): Promise<AIChatResponse> {
      const model = options?.model || 'gpt-4o-mini';
      const maxTokens = options?.maxTokens || 4096;

      const response = await openai.chat.completions.create({
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

export const openaiProvider = createOpenAIProvider();
