import Anthropic from '@anthropic-ai/sdk';
import type { AIProvider, AIMessage, AIChatOptions, AIChatResponse } from './index.js';

export function createClaudeProvider(apiKey?: string): AIProvider {
  let anthropic: Anthropic | null = null;
  
  function getClient(): Anthropic {
    if (!anthropic) {
      anthropic = new Anthropic({ apiKey: apiKey || process.env.ANTHROPIC_API_KEY });
    }
    return anthropic;
  }
  
  return {
    name: 'claude',

    async chat(
      messages: AIMessage[],
      options?: AIChatOptions
    ): Promise<AIChatResponse> {
      const model = options?.model || 'claude-sonnet-4-20250514';
      const maxTokens = options?.maxTokens || 4096;

      try {
        const response = await getClient().messages.create({
          model,
          max_tokens: maxTokens,
          messages: messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        });

        if (!response.content || response.content.length === 0) {
          throw new Error('Unexpected response: no content in Claude response');
        }

        const content = response.content[0];
        const text = content.type === 'text' ? content.text : '';

        return {
          content: text,
          tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
          model: response.model,
        };
      } catch (error) {
        if (error instanceof Error) {
          throw new Error(`Claude API error: ${error.message}`);
        }
        throw new Error('Claude API error: unknown error');
      }
    },
  };
}
