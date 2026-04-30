import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/auth.js';
import {
  getBudgetsHandler,
  getBudgetHandler,
  getBudgetSummaryHandler,
  updateBudgetSpentHandler,
  createBudgetHandler,
  updateBudgetHandler,
  deleteBudgetHandler,
} from './controller.js';

export async function budgetRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  fastify.get('/', {}, getBudgetsHandler);

  fastify.get('/summary', {}, getBudgetSummaryHandler);

  fastify.put('/:id/spent', {}, updateBudgetSpentHandler);

  fastify.get('/:id', {}, getBudgetHandler);

  fastify.post('/', {}, createBudgetHandler);

  fastify.put('/:id', {}, updateBudgetHandler);

  fastify.delete('/:id', {}, deleteBudgetHandler);
}