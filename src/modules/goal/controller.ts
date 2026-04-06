import type { FastifyRequest, FastifyReply } from 'fastify';
import { goalService } from './service.js';
import { createGoalSchema, updateGoalSchema, goalIdSchema, contributionSchema } from './schemas.js';

export async function getGoalsHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const goals = await goalService.getAllWithProgress(request.user.id);
  return reply.send({ goals });
}

export async function getGoalHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const { id } = goalIdSchema.parse(request.params);
  const goal = await goalService.getProgress(id, request.user.id);
  return reply.send({ goal });
}

export async function createGoalHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const input = createGoalSchema.parse(request.body);
  const goal = await goalService.create(request.user.id, input);
  return reply.status(201).send({ goal });
}

export async function updateGoalHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const { id } = goalIdSchema.parse(request.params);
  const input = updateGoalSchema.parse(request.body);
  const goal = await goalService.update(id, request.user.id, input);
  return reply.send({ goal });
}

export async function deleteGoalHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const { id } = goalIdSchema.parse(request.params);
  await goalService.delete(id, request.user.id);
  return reply.status(204).send();
}

export async function addContributionHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const { id } = goalIdSchema.parse(request.params);
  const input = contributionSchema.parse(request.body);
  const result = await goalService.addContribution(id, request.user.id, input);
  return reply.status(201).send(result);
}
