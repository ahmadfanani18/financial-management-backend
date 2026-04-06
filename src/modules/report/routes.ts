import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/auth.js';
import {
  getMonthlyReportHandler,
  getCategoryBreakdownHandler,
  getTrendsHandler,
  getCashFlowHandler,
  getNetWorthHandler,
} from './controller.js';

export async function reportRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  fastify.get('/monthly', getMonthlyReportHandler);
  fastify.get('/category-breakdown', getCategoryBreakdownHandler);
  fastify.get('/trends', getTrendsHandler);
  fastify.get('/cash-flow', getCashFlowHandler);
  fastify.get('/net-worth', getNetWorthHandler);
}
