import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/auth.js';
import {
  getGoalsHandler,
  getGoalHandler,
  createGoalHandler,
  updateGoalHandler,
  deleteGoalHandler,
  addContributionHandler,
} from './controller.js';

export async function goalRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  fastify.get('/', getGoalsHandler);
  fastify.get('/:id', getGoalHandler);
  fastify.post('/', createGoalHandler);
  fastify.put('/:id', updateGoalHandler);
  fastify.delete('/:id', deleteGoalHandler);
  fastify.post('/:id/contributions', addContributionHandler);
}
