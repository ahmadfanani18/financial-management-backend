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

  fastify.get('/', getPlansHandler);
  fastify.get('/:id', getPlanHandler);
  fastify.post('/', createPlanHandler);
  fastify.put('/:id', updatePlanHandler);
  fastify.delete('/:id', deletePlanHandler);

  fastify.post('/:id/milestones', addMilestoneHandler);
  fastify.put('/:id/milestones/reorder', reorderMilestonesHandler);
  
  fastify.put('/:planId/milestones/:milestoneId', updateMilestoneHandler);
  fastify.delete('/:planId/milestones/:milestoneId', deleteMilestoneHandler);
  fastify.patch('/:planId/milestones/:milestoneId/complete', completeMilestoneHandler);
}
