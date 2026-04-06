import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/auth.js';
import {
  getAccountsHandler,
  getAccountHandler,
  createAccountHandler,
  updateAccountHandler,
  deleteAccountHandler,
  getTotalBalanceHandler,
} from './controller.js';

export async function accountRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  fastify.get('/', getAccountsHandler);
  fastify.get('/balance/total', getTotalBalanceHandler);
  fastify.get('/:id', getAccountHandler);
  fastify.post('/', createAccountHandler);
  fastify.put('/:id', updateAccountHandler);
  fastify.delete('/:id', deleteAccountHandler);
}
