import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/auth.js';
import {
  getBillsHandler,
  getCurrentMonthBillsHandler,
  getBillHandler,
  createBillHandler,
  updateBillHandler,
  updateBillAmountHandler,
  deleteBillHandler,
  markAsPaidHandler,
  getBillsForExecutionHandler,
  getSummaryHandler,
} from './controller.js';

export async function billRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  fastify.get('/', {}, getBillsHandler);
  fastify.get('/current-month', {}, getCurrentMonthBillsHandler);
  fastify.get('/summary', {}, getSummaryHandler);
  fastify.get('/:id', {}, getBillHandler);
  fastify.post('/', {}, createBillHandler);
  fastify.put('/:id', {}, updateBillHandler);
  fastify.put('/:id/amount', {}, updateBillAmountHandler);
  fastify.delete('/:id', {}, deleteBillHandler);
  fastify.post('/:id/mark-paid', {}, markAsPaidHandler);
  fastify.get('/execute-due/:date', {}, getBillsForExecutionHandler);
}
