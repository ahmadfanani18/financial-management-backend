import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/auth.js';
import {
  getBudgetsHandler,
  getBudgetHandler,
  getBudgetSummaryHandler,
  createBudgetHandler,
  updateBudgetHandler,
  deleteBudgetHandler,
} from './controller.js';

export async function budgetRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  fastify.get('/', {
    schema: {
      response: { 200: { type: 'object', properties: { budgets: { type: 'array' } } } },
    },
  }, getBudgetsHandler),

  fastify.get('/summary', {
    schema: {
      response: { 200: { type: 'object' } },
    },
  }, getBudgetSummaryHandler);

  fastify.get('/:id', {
    schema: {
      params: { type: 'object', properties: { id: { type: 'string', format: 'uuid' } } },
    },
  }, getBudgetHandler);

  fastify.post('/', {
    schema: {
      body: {
        type: 'object',
        required: ['categoryId', 'amount', 'startDate'],
        properties: {
          categoryId: { type: 'string', format: 'uuid' },
          amount: { type: 'number' },
          period: { type: 'string', enum: ['MONTHLY', 'WEEKLY', 'YEARLY', 'CUSTOM'], default: 'MONTHLY' },
          startDate: { type: 'string' },
          endDate: { type: 'string' },
          warningThreshold: { type: 'number', default: 80 },
          isActive: { type: 'boolean', default: true },
        },
      },
    },
  }, createBudgetHandler);

  fastify.put('/:id', {
    schema: {
      params: { type: 'object', properties: { id: { type: 'string', format: 'uuid' } } },
    },
  }, updateBudgetHandler);

  fastify.delete('/:id', {
    schema: {
      params: { type: 'object', properties: { id: { type: 'string', format: 'uuid' } } },
    },
  }, deleteBudgetHandler);
}
