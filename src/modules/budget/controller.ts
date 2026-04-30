import type { FastifyRequest, FastifyReply } from 'fastify';
import { budgetService } from './service.js';
import { createBudgetSchema, updateBudgetSchema, budgetIdSchema } from './schemas.js';

export async function getBudgetsHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const budgets = await budgetService.getAllWithSpending(request.user.id);
  return reply.send({ budgets });
}

export async function getBudgetSummaryHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const summary = await budgetService.getSummary(request.user.id);
  return reply.send(summary);
}

export async function getBudgetHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const { id } = budgetIdSchema.parse(request.params);
  const budget = await budgetService.getSpending(id, request.user.id);
  return reply.send(budget);
}

export async function createBudgetHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const input = createBudgetSchema.parse(request.body);
  const budget = await budgetService.create(request.user.id, input);
  return reply.status(201).send({ budget });
}

export async function updateBudgetHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const { id } = budgetIdSchema.parse(request.params);
  const input = updateBudgetSchema.parse(request.body);
  const budget = await budgetService.update(id, request.user.id, input);
  return reply.send({ budget });
}

export async function deleteBudgetHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const { id } = budgetIdSchema.parse(request.params);
  await budgetService.delete(id, request.user.id);
  return reply.status(204).send();
}
