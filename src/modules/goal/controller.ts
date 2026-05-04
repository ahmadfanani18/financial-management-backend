import type { FastifyRequest, FastifyReply } from 'fastify';
import { goalService } from './service.js';
import { createGoalSchema, updateGoalSchema, goalIdSchema, milestoneIdSchema, contributionSchema, contributionWithAccountSchema, createGoalFromMilestoneSchema } from './schemas.js';

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

export async function toggleLockHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const { id } = goalIdSchema.parse(request.params);
  const goal = await goalService.toggleLock(id, request.user.id);
  return reply.send({ goal });
}

export async function deleteGoalWithTransactionHandler(
  request: FastifyRequest<{ Params: { id: string }; Body: { accountId?: string } }>,
  reply: FastifyReply
) {
  const { id } = goalIdSchema.parse(request.params);
  const { accountId } = request.body || {};
  await goalService.deleteWithTransaction(id, request.user.id, accountId);
  return reply.status(204).send();
}

export async function getContributionsHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const { id } = goalIdSchema.parse(request.params);
  const contributions = await goalService.getContributions(id, request.user.id);
  return reply.send({ contributions });
}

export async function addContributionWithAccountHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const { id } = goalIdSchema.parse(request.params);
  const input = contributionWithAccountSchema.parse(request.body);
  const result = await goalService.addContribution(id, request.user.id, input, input.accountId);
  return reply.status(201).send(result);
}

export async function createGoalFromMilestoneHandler(
  request: FastifyRequest<{ Params: { milestoneId: string } }>,
  reply: FastifyReply
) {
  const { milestoneId } = milestoneIdSchema.parse(request.params);
  const input = createGoalFromMilestoneSchema.parse(request.body || {});
  const goal = await goalService.createFromMilestone(milestoneId, request.user.id, input);
  return reply.status(201).send({ goal });
}

export async function deleteGoalWithRefundHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const { id } = goalIdSchema.parse(request.params);
  
  try {
    await goalService.deleteWithRefund(id, request.user.id);
    return reply.status(204).send();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return reply.status(400).send({ error: true, message });
  }
}
