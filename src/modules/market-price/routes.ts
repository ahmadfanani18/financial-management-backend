import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/auth.js';
import { getMarketPricesHandler, searchMarketPricesHandler } from './controller.js';

export async function marketPriceRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  fastify.get('/prices', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          symbols: { type: 'string' },
        },
      },
    },
  }, getMarketPricesHandler);

  fastify.get('/search', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          type: { type: 'string', enum: ['CRYPTO', 'US_STOCK', 'IDX_STOCK'] },
        },
        required: ['query'],
      },
    },
  }, searchMarketPricesHandler);
}
