import { prisma } from '../../config/prisma.js';
import { encrypt, decrypt, isEncrypted } from '../ai/crypto.js';
import { createGeminiProvider } from '../ai/providers/gemini.js';
import { createOpenAIProvider } from '../ai/providers/openai.js';
import { createClaudeProvider } from '../ai/providers/claude.js';

interface ValidateResult {
  valid: boolean;
  error?: string;
}

async function validateApiKey(provider: string, apiKey: string): Promise<ValidateResult> {
  try {
    if (provider === 'gemini') {
      const p = createGeminiProvider(apiKey);
      await p.chat([{ role: 'user', content: 'hi' }], { maxTokens: 5 });
    } else if (provider === 'openai') {
      const p = createOpenAIProvider(apiKey);
      await p.chat([{ role: 'user', content: 'hi' }], { maxTokens: 5 });
    } else if (provider === 'claude') {
      const p = createClaudeProvider(apiKey);
      await p.chat([{ role: 'user', content: 'hi' }], { maxTokens: 5 });
    }
    return { valid: true };
  } catch (e) {
    return { valid: false, error: e instanceof Error ? e.message : 'Invalid API key' };
  }
}

interface SaveApiKeysResult {
  success: boolean;
  validatedProviders: string[];
  failedProviders: Record<string, string>;
}

export async function saveApiKeys(
  userId: string,
  keys: {
    geminiApiKey?: string;
    openaiApiKey?: string;
    claudeApiKey?: string;
    primaryProvider?: string;
  }
): Promise<SaveApiKeysResult> {
  const validatedProviders: string[] = [];
  const failedProviders: Record<string, string> = {};

  const updateData: Record<string, string | null> = {};

  if (keys.geminiApiKey) {
    // Skip validation - just save the key
    updateData.geminiApiKey = encrypt(keys.geminiApiKey);
    validatedProviders.push('gemini');
  }

  if (keys.openaiApiKey) {
    updateData.openaiApiKey = encrypt(keys.openaiApiKey);
    validatedProviders.push('openai');
  }

  if (keys.claudeApiKey) {
    updateData.claudeApiKey = encrypt(keys.claudeApiKey);
    validatedProviders.push('claude');
  }

  if (keys.primaryProvider) {
    updateData.aiPrimaryProvider = keys.primaryProvider;
  }

  if (Object.keys(updateData).length > 0) {
    await prisma.user.update({
      where: { id: userId },
      data: updateData,
    });
  }

  return {
    success: validatedProviders.length > 0 || Object.keys(failedProviders).length === 0,
    validatedProviders,
    failedProviders,
  };
}

interface GetApiKeysResult {
  configuredProviders: string[];
  primaryProvider: string | null;
  hasAnyKey: boolean;
}

export async function getApiKeysStatus(userId: string): Promise<GetApiKeysResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { geminiApiKey: true, openaiApiKey: true, claudeApiKey: true, aiPrimaryProvider: true },
  });

  if (!user) {
    return { configuredProviders: [], primaryProvider: null, hasAnyKey: false };
  }

  const configuredProviders: string[] = [];
  if (user.geminiApiKey) configuredProviders.push('gemini');
  if (user.openaiApiKey) configuredProviders.push('openai');
  if (user.claudeApiKey) configuredProviders.push('claude');

  return {
    configuredProviders,
    primaryProvider: user.aiPrimaryProvider,
    hasAnyKey: configuredProviders.length > 0,
  };
}

export function getDecryptedKey(encryptedKey: string | null): string | null {
  if (!encryptedKey) return null;
  if (!isEncrypted(encryptedKey)) return encryptedKey;
  return decrypt(encryptedKey);
}

export async function getUserWithApiKeys(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      geminiApiKey: true,
      openaiApiKey: true,
      claudeApiKey: true,
      aiPrimaryProvider: true,
    },
  });
  
  if (!user) return null;
  
  return {
    geminiApiKey: user.geminiApiKey ? getDecryptedKey(user.geminiApiKey) : null,
    openaiApiKey: user.openaiApiKey ? getDecryptedKey(user.openaiApiKey) : null,
    claudeApiKey: user.claudeApiKey ? getDecryptedKey(user.claudeApiKey) : null,
    aiPrimaryProvider: user.aiPrimaryProvider,
  };
}
