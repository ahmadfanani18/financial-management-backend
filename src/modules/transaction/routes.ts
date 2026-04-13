import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/auth.js';
import {
  getTransactionsHandler,
  getTransactionHandler,
  createTransactionHandler,
  updateTransactionHandler,
  deleteTransactionHandler,
  getRecentTransactionsHandler,
  getSummaryHandler,
} from './controller.js';

export async function transactionRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  fastify.get('/', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'number', default: 1 },
          limit: { type: 'number', default: 20 },
          accountId: { type: 'string', format: 'uuid' },
          categoryId: { type: 'string', format: 'uuid' },
          type: { type: 'string' },  // Validation handled in service layer
          startDate: { type: 'string', format: 'date' },
          endDate: { type: 'string', format: 'date' },
          search: { type: 'string' },
        },
      },
    },
  }, getTransactionsHandler);

  fastify.get('/recent', {
    schema: {
      querystring: {
        type: 'object',
        properties: { limit: { type: 'number', default: 5 } },
      },
    },
  }, getRecentTransactionsHandler);

  fastify.get('/summary', {
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
  }, getSummaryHandler);

  fastify.get('/:id', {
    schema: {
      params: { type: 'object', properties: { id: { type: 'string', format: 'uuid' } } },
    },
  }, getTransactionHandler);

  fastify.post('/', {
    schema: {
      body: {
        type: 'object',
        required: ['accountId', 'type', 'amount'],
        properties: {
          accountId: { type: 'string', format: 'uuid' },
          categoryId: { type: 'string', format: 'uuid' },
          type: { type: 'string', enum: ['INCOME', 'EXPENSE', 'TRANSFER'] },
          amount: { type: 'number' },
          description: { type: 'string' },
          date: { type: 'string' },
          fromAccountId: { type: 'string', format: 'uuid' },
          toAccountId: { type: 'string', format: 'uuid' },
        },
      },
    },
  }, createTransactionHandler);

  fastify.put('/:id', {
    schema: {
      params: { type: 'object', properties: { id: { type: 'string', format: 'uuid' } } },
    },
  }, updateTransactionHandler);

  fastify.delete('/:id', {
    schema: {
      params: { type: 'object', properties: { id: { type: 'string', format: 'uuid' } } },
    },
  }, deleteTransactionHandler);
}
