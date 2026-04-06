import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/auth.js';
import {
  generatePlanHandler,
  predictSpendingHandler,
  suggestSavingsHandler,
} from './controller.js';

export async function aiRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  fastify.post('/generate-plan', generatePlanHandler);
  fastify.post('/predict-spending', predictSpendingHandler);
  fastify.post('/suggest-savings', suggestSavingsHandler);
}
