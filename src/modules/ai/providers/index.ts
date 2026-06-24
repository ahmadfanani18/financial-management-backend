export interface AIMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AIChatOptions {
  model?: string;
  maxTokens?: number;
}

export interface AIChatResponse {
  content: string;
  tokensUsed: number;
  model: string;
}

export interface AIProvider {
  name: string;
  chat(
    messages: AIMessage[],
    options?: AIChatOptions
  ): Promise<AIChatResponse>;
}
