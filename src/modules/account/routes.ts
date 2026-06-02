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

  fastify.get('/', {
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            accounts: { type: 'array' },
          },
        },
      },
    },
  }, getAccountsHandler);

  fastify.get('/balance/total', {
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            total: { type: 'number' },
          },
        },
      },
    },
  }, getTotalBalanceHandler);

  fastify.get('/:id', {
    schema: {
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
        required: ['id'],
      },
    },
  }, getAccountHandler);

  fastify.post('/', {
    schema: {
      body: {
        type: 'object',
        required: ['name', 'type'],
        properties: {
          name: { type: 'string' },
          type: { type: 'string', enum: ['BANK', 'EWALLET', 'CASH', 'CREDIT_CARD', 'INVESTMENT'] },
          balance: { type: 'number', default: 0 },
          currency: { type: 'string', default: 'IDR' },
          icon: { type: 'string', default: 'wallet' },
          color: { type: 'string', default: '#0EA5E9' },
        },
      },
    },
  }, createAccountHandler);

  fastify.put('/:id', {
    schema: {
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
        required: ['id'],
      },
    },
  }, updateAccountHandler);

  fastify.delete('/:id', {
    schema: {
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
        required: ['id'],
      },
    },
  }, deleteAccountHandler);
}
