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

  fastify.get('/', getTransactionsHandler);
  fastify.get('/recent', getRecentTransactionsHandler);
  fastify.get('/summary', getSummaryHandler);
  fastify.get('/:id', getTransactionHandler);
  fastify.post('/', createTransactionHandler);
  fastify.put('/:id', updateTransactionHandler);
  fastify.delete('/:id', deleteTransactionHandler);
}
