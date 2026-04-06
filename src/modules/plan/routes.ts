import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/auth.js';
import {
  getPlansHandler,
  getPlanHandler,
  createPlanHandler,
  updatePlanHandler,
  deletePlanHandler,
  addMilestoneHandler,
  updateMilestoneHandler,
  deleteMilestoneHandler,
  completeMilestoneHandler,
  reorderMilestonesHandler,
} from './controller.js';

export async function planRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  fastify.get('/', {
    schema: {
      response: { 200: { type: 'object', properties: { plans: { type: 'array' } } } },
    },
  }, getPlansHandler);

  fastify.get('/:id', {
    schema: {
      params: { type: 'object', properties: { id: { type: 'string', format: 'uuid' } } },
    },
  }, getPlanHandler);

  fastify.post('/', {
    schema: {
      body: {
        type: 'object',
        required: ['name', 'startDate', 'endDate'],
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          startDate: { type: 'string' },
          endDate: { type: 'string' },
          status: { type: 'string', enum: ['ACTIVE', 'COMPLETED', 'ARCHIVED'], default: 'ACTIVE' },
        },
      },
    },
  }, createPlanHandler);

  fastify.put('/:id', {
    schema: {
      params: { type: 'object', properties: { id: { type: 'string', format: 'uuid' } } },
    },
  }, updatePlanHandler);

  fastify.delete('/:id', {
    schema: {
      params: { type: 'object', properties: { id: { type: 'string', format: 'uuid' } } },
    },
  }, deletePlanHandler);

  fastify.post('/:id/milestones', {
    schema: {
      params: { type: 'object', properties: { id: { type: 'string', format: 'uuid' } } },
      body: {
        type: 'object',
        required: ['title', 'targetDate'],
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          targetDate: { type: 'string' },
          targetAmount: { type: 'number' },
        },
      },
    },
  }, addMilestoneHandler);

  fastify.put('/:id/milestones/reorder', {
    schema: {
      params: { type: 'object', properties: { id: { type: 'string', format: 'uuid' } } },
      body: {
        type: 'object',
        properties: {
          milestones: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', format: 'uuid' },
                order: { type: 'number' },
              },
            },
          },
        },
      },
    },
  }, reorderMilestonesHandler);

  fastify.put('/:planId/milestones/:milestoneId', {
    schema: {
      params: {
        type: 'object',
        properties: {
          planId: { type: 'string', format: 'uuid' },
          milestoneId: { type: 'string', format: 'uuid' },
        },
      },
    },
  }, updateMilestoneHandler);

  fastify.delete('/:planId/milestones/:milestoneId', {
    schema: {
      params: {
        type: 'object',
        properties: {
          planId: { type: 'string', format: 'uuid' },
          milestoneId: { type: 'string', format: 'uuid' },
        },
      },
    },
  }, deleteMilestoneHandler);

  fastify.patch('/:planId/milestones/:milestoneId/complete', {
    schema: {
      params: {
        type: 'object',
        properties: {
          planId: { type: 'string', format: 'uuid' },
          milestoneId: { type: 'string', format: 'uuid' },
        },
      },
    },
  }, completeMilestoneHandler);
}
