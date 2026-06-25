import type { FastifyInstance } from 'fastify';
import { authenticate, requireAdmin } from '../../middleware/auth.js';
import {
  createFeedbackHandler,
  getMyFeedbackHandler,
  getAllFeedbackHandler,
  updateFeedbackStatusHandler,
} from './controller.js';

export async function feedbackRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  fastify.get('/feedback', getMyFeedbackHandler);
  fastify.post('/feedback', {
    schema: {
      body: {
        type: 'object',
        required: ['type', 'subject', 'description'],
        properties: {
          type: { type: 'string', enum: ['BUG', 'SUGGESTION'] },
          subject: { type: 'string', minLength: 3, maxLength: 200 },
          description: { type: 'string', minLength: 10, maxLength: 5000 },
          screenshot: { type: 'string' },
        },
      },
    },
  }, createFeedbackHandler);

  fastify.get('/admin/feedback', { preHandler: requireAdmin }, getAllFeedbackHandler);
  fastify.patch('/admin/feedback/:id', { preHandler: requireAdmin }, updateFeedbackStatusHandler);
}
