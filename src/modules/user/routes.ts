import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/auth.js';
import { getProfileHandler, updateProfileHandler, getNotificationPreferencesHandler, updateNotificationPreferencesHandler } from './controller.js';
import { saveApiKeysHandler, getApiKeysStatusHandler } from './api-keys-controller.js';

export async function userRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  fastify.get('/me', getProfileHandler);
  fastify.put('/me', updateProfileHandler);

  fastify.get('/preferences/notifications', getNotificationPreferencesHandler);

  fastify.put('/preferences/notifications', {
    schema: {
      body: {
        type: 'object',
        properties: {
          budgetWarning: { type: 'boolean' },
          goalMilestone: { type: 'boolean' },
          planReminder: { type: 'boolean' },
          accountAlert: { type: 'boolean' },
          dailySummary: { type: 'boolean' },
          recurringTransaction: { type: 'boolean' },
        },
      },
    },
  }, updateNotificationPreferencesHandler);

  fastify.post('/api-keys', {
    schema: {
      body: {
        type: 'object',
        properties: {
          geminiApiKey: { type: 'string' },
          openaiApiKey: { type: 'string' },
          claudeApiKey: { type: 'string' },
          primaryProvider: { type: 'string', enum: ['gemini', 'openai', 'claude'] },
        },
      },
    },
  }, saveApiKeysHandler);

  fastify.get('/api-keys', getApiKeysStatusHandler);
}