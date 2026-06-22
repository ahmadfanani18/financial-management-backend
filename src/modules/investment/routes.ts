import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/auth.js';
import {
  getHoldingsHandler,
  createHoldingHandler,
  updateHoldingHandler,
  deleteHoldingHandler,
} from './controller.js';

export async function investmentRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  fastify.get('/holdings', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          accountId: { type: 'string' },
        },
        required: ['accountId'],
      },
    },
  }, getHoldingsHandler);

  fastify.post('/holdings', {
    schema: {
      body: {
        type: 'object',
        required: ['accountId', 'symbol', 'shares', 'avgBuyPrice'],
        properties: {
          accountId: { type: 'string' },
          symbol: { type: 'string' },
          shares: { type: 'string' },
          avgBuyPrice: { type: 'string' },
        },
      },
    },
  }, createHoldingHandler);

  fastify.put('/holdings/:id', {
    schema: {
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
        required: ['id'],
      },
    },
  }, updateHoldingHandler);

  fastify.delete('/holdings/:id', {
    schema: {
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
        required: ['id'],
      },
    },
  }, deleteHoldingHandler);
}