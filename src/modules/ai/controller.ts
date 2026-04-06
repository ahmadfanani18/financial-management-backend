import type { FastifyRequest, FastifyReply } from 'fastify';
import { aiService } from './service.js';
import { generatePlanSchema, predictSpendingSchema } from './schemas.js';

export async function generatePlanHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const input = generatePlanSchema.parse(request.body);
  const result = await aiService.generatePlan(request.user.id, input);
  return reply.send(result);
}

export async function predictSpendingHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const input = predictSpendingSchema.parse(request.body);
  const result = await aiService.predictSpending(request.user.id, input);
  return reply.send(result);
}

export async function suggestSavingsHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const result = await aiService.suggestSavings(request.user.id);
  return reply.send(result);
}
