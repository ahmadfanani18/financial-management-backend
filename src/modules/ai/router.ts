import type { AIProvider, AIMessage, AIChatResponse } from './providers/index.js';
import { createClaudeProvider } from './providers/claude.js';
import { createOpenAIProvider } from './providers/openai.js';
import { createGeminiProvider } from './providers/gemini.js';

export type QueryComplexity = 'simple' | 'analysis' | 'complex';

interface RouterConfig {
  claude?: string;
  openai?: string;
  gemini?: string;
}

interface RouteResult extends AIChatResponse {
  provider: string;
}

const SIMPLE_PATTERNS = [
  /^(berapa|ada|apa|siapa|kapan|show|list|tolong|kerjakan)/i,
  /^(buatkan|cek|check|lihat|see|get|find)/i,
];

const COMPLEX_PATTERNS = [
  /(analisa mendalam|bandingkan|strategy|why|should i|haruskah|kenapa)/i,
  /(rekomendasikan|optimize|improve|maximize|minimalisir)/i,
  /(forecast|prediksi|proyeksi|estimasi)/i,
  /(risk|risiko|aversi|diversifikasi|portofolio)/i,
];

export function classifyQuery(message: string): QueryComplexity {
  const lowerMessage = message.toLowerCase().trim();

  for (const pattern of SIMPLE_PATTERNS) {
    if (pattern.test(lowerMessage)) {
      return 'simple';
    }
  }

  for (const pattern of COMPLEX_PATTERNS) {
    if (pattern.test(lowerMessage)) {
      return 'complex';
    }
  }

  return 'analysis';
}

const FALLBACK_CHAINS: Record<QueryComplexity, string[]> = {
  simple: ['gemini', 'openai', 'claude'],
  analysis: ['claude', 'openai', 'gemini'],
  complex: ['claude', 'openai', 'gemini'],
};

const DEFAULT_MODELS: Record<string, string> = {
  mock: 'mock',
  claude: 'claude-3-5-sonnet-20241022',
  openai: 'gpt-4o-mini',
  gemini: 'gemini-3.5-flash',
};

export interface Router {
  route(messages: AIMessage[], complexity: QueryComplexity): Promise<RouteResult>;
  classify(message: string): QueryComplexity;
}

export function createRouter(config: RouterConfig): Router {
  const mockProvider: AIProvider = {
    name: 'mock',
    async chat(messages) {
      const lastMessage = messages[messages.length - 1]?.content || '';
      return {
        content: `Mock AI: Terima kasih atas pesan Anda "${lastMessage.substring(0, 50)}...". Fitur AI sedang dalam pengembangan. Gunakan API key yang valid untuk response sungguhan.`,
        tokensUsed: 50,
        model: 'mock',
      };
    },
  };

  const providers: Record<string, AIProvider | undefined> = {
    mock: mockProvider,
    openai: config.openai ? createOpenAIProvider(config.openai) : createOpenAIProvider(),
    claude: config.claude ? createClaudeProvider(config.claude) : createClaudeProvider(),
    gemini: config.gemini ? createGeminiProvider(config.gemini) : createGeminiProvider(),
  };

  return {
    classify(message: string): QueryComplexity {
      return classifyQuery(message);
    },

    async route(messages: AIMessage[], complexity: QueryComplexity): Promise<RouteResult> {
      const chain = FALLBACK_CHAINS[complexity];
      let lastError: Error | null = null;

      for (const providerName of chain) {
        const provider = providers[providerName];
        if (!provider) continue;

        try {
          const result = await provider.chat(messages, {
            model: DEFAULT_MODELS[providerName],
          });

          return {
            ...result,
            provider: providerName,
          };
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          continue;
        }
      }

      throw lastError || new Error('All providers failed');
    },
  };
}
