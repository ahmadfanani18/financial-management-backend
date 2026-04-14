import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/auth.js';
import {
  getMonthlyReportHandler,
  getCategoryBreakdownHandler,
  getTrendsHandler,
  getCashFlowHandler,
  getNetWorthHandler,
  exportTransactionsHandler,
} from './controller.js';

export async function reportRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  fastify.get('/monthly', {
    schema: {
      querystring: {
        type: 'object',
        required: ['year', 'month'],
        properties: {
          year: { type: 'number' },
          month: { type: 'number', minimum: 1, maximum: 12 },
        },
      },
    },
  }, getMonthlyReportHandler);

  fastify.get('/category-breakdown', {
    schema: {
      querystring: {
        type: 'object',
        required: ['startDate', 'endDate'],
        properties: {
          startDate: { type: 'string' },
          endDate: { type: 'string' },
        },
      },
    },
  }, getCategoryBreakdownHandler);

  fastify.get('/trends', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          months: { type: 'number', minimum: 1, maximum: 12, default: 6 },
        },
      },
    },
  }, getTrendsHandler);

  fastify.get('/cash-flow', {
    schema: {
      querystring: {
        type: 'object',
        required: ['startDate', 'endDate'],
        properties: {
          startDate: { type: 'string' },
          endDate: { type: 'string' },
        },
      },
    },
  }, getCashFlowHandler);

  fastify.get('/net-worth', getNetWorthHandler);

  fastify.get('/export/transactions', {
    schema: {
      querystring: {
        type: 'object',
        required: ['year', 'month'],
        properties: {
          year: { type: 'number' },
          month: { type: 'number', minimum: 1, maximum: 12 },
        },
      },
    },
  }, exportTransactionsHandler);
}
