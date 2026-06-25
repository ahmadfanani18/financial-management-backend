import OpenAI from 'openai';
import type { AIProvider, AIMessage, AIChatOptions, AIChatResponse } from './index.js';

export function createOpenAIProvider(apiKey?: string): AIProvider {
  let openai: OpenAI | null = null;
  
  function getClient(): OpenAI {
    if (!openai) {
      openai = new OpenAI({ 
        apiKey: apiKey || process.env.OPENAI_API_KEY,
        baseURL: process.env.OPENAI_BASE_URL || undefined,
      });
    }
    return openai;
  }
  
  return {
    name: 'openai',

    async chat(
      messages: AIMessage[],
      options?: AIChatOptions
    ): Promise<AIChatResponse> {
      const model = options?.model || 'gpt-4o-mini';
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
          throw new Error('Unexpected response: no choices in OpenAI response');
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
          throw new Error(`OpenAI API error: ${error.message}`);
        }
        throw new Error('OpenAI API error: unknown error');
      }
    },
  };
}
