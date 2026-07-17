import type { FastifyRequest, FastifyReply } from 'fastify';
import { billService } from './service.js';
import { createBillSchema, updateBillSchema, updateBillAmountSchema, markPaidSchema, billIdSchema } from './schemas.js';

export async function getBillsHandler(request: FastifyRequest, reply: FastifyReply) {
  const bills = await billService.getAll(request.user.id);
  return reply.send({ bills });
}

export async function getCurrentMonthBillsHandler(request: FastifyRequest, reply: FastifyReply) {
  const result = await billService.getCurrentMonthBills(request.user.id);
  return reply.send(result);
}

export async function getSummaryHandler(request: FastifyRequest, reply: FastifyReply) {
  const summary = await billService.getSummary(request.user.id);
  return reply.send(summary);
}

export async function getBillHandler(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
  const { id } = billIdSchema.parse(request.params);
  const bill = await billService.getById(id, request.user.id);
  return reply.send({ bill });
}

export async function createBillHandler(request: FastifyRequest, reply: FastifyReply) {
  const input = createBillSchema.parse(request.body);
  const bill = await billService.create(request.user.id, input);
  return reply.status(201).send({ bill });
}

export async function updateBillHandler(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
  const { id } = billIdSchema.parse(request.params);
  const input = updateBillSchema.parse(request.body);
  const bill = await billService.update(id, request.user.id, input);
  return reply.send({ bill });
}

export async function updateBillAmountHandler(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
  const { id } = billIdSchema.parse(request.params);
  const { amount } = updateBillAmountSchema.parse(request.body);
  const bill = await billService.updateAmount(id, request.user.id, amount);
  return reply.send({ bill });
}

export async function deleteBillHandler(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
  const { id } = billIdSchema.parse(request.params);
  await billService.delete(id, request.user.id);
  return reply.status(204).send();
}

export async function markAsPaidHandler(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
  const { id } = billIdSchema.parse(request.params);
  const { amount, createTransaction } = markPaidSchema.parse(request.body || {});
  const result = await billService.markAsPaid(id, request.user.id, amount, createTransaction);
  return reply.status(201).send(result);
}

export async function getBillsForExecutionHandler(request: FastifyRequest<{ Params: { date: string } }>, reply: FastifyReply) {
  const date = parseInt(request.params.date);
  const bills = await billService.getBillsForExecution(date);
  return reply.send({ bills });
}
