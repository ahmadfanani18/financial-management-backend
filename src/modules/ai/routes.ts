import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/auth.js';
import {
  generatePlanHandler,
  predictSpendingHandler,
  suggestSavingsHandler,
  generatePlanFromDataHandler,
} from './controller.js';

export async function aiRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  fastify.post('/generate-plan', {
    schema: {
      body: {
        type: 'object',
        required: ['monthlyIncome'],
        properties: {
          monthlyIncome: { type: 'number' },
          currency: { type: 'string', default: 'IDR' },
        },
      },
    },
  }, generatePlanHandler);

  fastify.post('/generate-plan-from-data', {
    schema: {
      response: { 
        200: { 
          type: 'object',
          properties: {
            plan: { type: 'object' },
            summary: { type: 'object' },
          },
        },
        400: {
          type: 'object',
          properties: {
            error: { type: 'boolean' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, generatePlanFromDataHandler);

  fastify.post('/predict-spending', {
    schema: {
      body: {
        type: 'object',
        properties: {
          months: { type: 'number', minimum: 1, maximum: 12, default: 3 },
        },
      },
    },
  }, predictSpendingHandler);

  fastify.post('/suggest-savings', suggestSavingsHandler);
}
