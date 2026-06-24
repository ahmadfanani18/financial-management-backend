import Anthropic from '@anthropic-ai/sdk';
import type { AIProvider, AIMessage, AIChatOptions, AIChatResponse } from './index.js';

const anthropic = new Anthropic();

export function createClaudeProvider(): AIProvider {
  return {
    name: 'claude',

    async chat(
      messages: AIMessage[],
      options?: AIChatOptions
    ): Promise<AIChatResponse> {
      const model = options?.model || 'claude-sonnet-4-20250514';
      const maxTokens = options?.maxTokens || 4096;

      const systemMessage = messages.find((m) => m.role === 'assistant');
      const userMessages = messages.filter((m) => m.role === 'user');

      const response = await anthropic.messages.create({
        model,
        max_tokens: maxTokens,
        system: systemMessage?.content,
        messages: userMessages.map((m) => ({
          role: m.role as 'user',
          content: m.content,
        })),
      });

      const content = response.content[0];
      const text = content.type === 'text' ? content.text : '';

      return {
        content: text,
        tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
        model: response.model,
      };
    },
  };
}

export const claudeProvider = createClaudeProvider();
