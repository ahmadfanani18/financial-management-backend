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

  fastify.get('/', {
    schema: {
      response: { 200: { type: 'object', properties: { goals: { type: 'array' } } } },
    },
  }, getGoalsHandler);

  fastify.get('/:id', {
    schema: {
      params: { type: 'object', properties: { id: { type: 'string', format: 'uuid' } } },
    },
  }, getGoalHandler);

  fastify.post('/', {
    schema: {
      body: {
        type: 'object',
        required: ['name', 'targetAmount', 'deadline'],
        properties: {
          name: { type: 'string' },
          targetAmount: { type: 'number' },
          deadline: { type: 'string' },
          icon: { type: 'string', default: 'target' },
          color: { type: 'string', default: '#10B981' },
        },
      },
    },
  }, createGoalHandler);

  fastify.put('/:id', {
    schema: {
      params: { type: 'object', properties: { id: { type: 'string', format: 'uuid' } } },
    },
  }, updateGoalHandler);

  fastify.delete('/:id', {
    schema: {
      params: { type: 'object', properties: { id: { type: 'string', format: 'uuid' } } },
    },
  }, deleteGoalHandler);

  fastify.post('/:id/contributions', {
    schema: {
      params: { type: 'object', properties: { id: { type: 'string', format: 'uuid' } } },
      body: {
        type: 'object',
        required: ['amount', 'date'],
        properties: {
          amount: { type: 'number' },
          date: { type: 'string' },
          note: { type: 'string' },
        },
      },
    },
  }, addContributionHandler);
}
