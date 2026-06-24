import type { FastifyInstance } from 'fastify';
import { authenticate, requireAdmin } from '../../middleware/auth.js';
import {
  getUserReportHandler,
  getSubscriptionReportHandler,
  getActivityReportHandler,
} from './controller.js';

export async function adminReportRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', requireAdmin);

  fastify.get('/users', getUserReportHandler);
  fastify.get('/subscriptions', getSubscriptionReportHandler);
  fastify.get('/activity', getActivityReportHandler);
}
