import type { FastifyRequest, FastifyReply } from 'fastify';
import { saveApiKeys, getApiKeysStatus } from './api-keys-service.js';

interface SaveApiKeysBody {
  geminiApiKey?: string;
  openaiApiKey?: string;
  claudeApiKey?: string;
  primaryProvider?: string;
}

export async function saveApiKeysHandler(
  request: FastifyRequest<{ Body: SaveApiKeysBody }>,
  reply: FastifyReply
) {
  const userId = (request as any).user.id;
  const { geminiApiKey, openaiApiKey, claudeApiKey, primaryProvider } = request.body;

  const result = await saveApiKeys(userId, {
    geminiApiKey,
    openaiApiKey,
    claudeApiKey,
    primaryProvider,
  });

  return reply.send(result);
}

export async function getApiKeysStatusHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const userId = (request as any).user.id;
  const result = await getApiKeysStatus(userId);
  return reply.send(result);
}
