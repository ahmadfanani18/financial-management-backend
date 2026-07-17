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

const MODEL_TO_PROVIDER: Record<string, { provider: string; model: string }> = {
  'claude-sonnet': { provider: 'claude', model: 'claude-sonnet-4-20250514' },
  'claude-opus': { provider: 'claude', model: 'claude-opus-4-20250514' },
  'gpt-4o-mini': { provider: 'openai', model: 'gpt-4o-mini' },
  'gpt-4o': { provider: 'openai', model: 'gpt-4o' },
  'gemini-flash': { provider: 'gemini', model: 'gemini-2.0-flash' },
  'gemini-pro': { provider: 'gemini', model: 'gemini-2.0-pro' },
};

function selectProviderByModel(model?: string): { provider: string; model: string; isAuto: boolean } | null {
  if (!model || model === 'auto') {
    return null;
  }

  const mapping = MODEL_TO_PROVIDER[model];
  if (!mapping) {
    return null;
  }

  return { ...mapping, isAuto: false };
}

const DEFAULT_MODELS: Record<string, string> = {
  mock: 'mock',
  claude: 'claude-3-5-sonnet-20241022',
  openai: 'gpt-4o-mini',
  gemini: 'gemini-3.5-flash',
};

export interface Router {
  route(messages: AIMessage[], complexity: QueryComplexity, model?: string): Promise<RouteResult>;
  classify(message: string): QueryComplexity;
}

export { selectProviderByModel };

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

    async route(messages: AIMessage[], complexity: QueryComplexity, model?: string): Promise<RouteResult> {
      const explicitModel = selectProviderByModel(model);
      if (explicitModel) {
        const provider = providers[explicitModel.provider];
        if (provider) {
          try {
            const result = await provider.chat(messages, { model: explicitModel.model });
            return { ...result, provider: explicitModel.provider };
          } catch (primaryError) {
            const FALLBACK_CHAIN = ['openai', 'gemini', 'claude'];
            for (const fallbackProvider of FALLBACK_CHAIN) {
              if (fallbackProvider === explicitModel.provider) continue;
              const fallbackP = providers[fallbackProvider];
              if (!fallbackP) continue;
              try {
                const defaultModel = DEFAULT_MODELS[fallbackProvider];
                const result = await fallbackP.chat(messages, { model: defaultModel });
                return { ...result, provider: fallbackProvider };
              } catch {
                continue;
              }
            }
            throw primaryError instanceof Error ? primaryError : new Error(String(primaryError));
          }
        }
      }

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
