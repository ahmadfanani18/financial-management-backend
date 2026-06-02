import type { FastifyRequest, FastifyReply } from 'fastify';
import { planService } from './service.js';
import { 
  createPlanSchema, updatePlanSchema, planIdSchema,
  createMilestoneSchema, updateMilestoneSchema, milestoneIdSchema,
  reorderMilestonesSchema 
} from './schemas.js';

export async function getPlansHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const plans = await planService.getAll(request.user.id);
  return reply.send({ plans });
}

export async function getPlanHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const { id } = planIdSchema.parse(request.params);
  const plan = await planService.getById(id, request.user.id);
  return reply.send({ plan });
}

export async function createPlanHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const input = createPlanSchema.parse(request.body);
  const plan = await planService.create(request.user.id, input);
  return reply.status(201).send({ plan });
}

export async function updatePlanHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const { id } = planIdSchema.parse(request.params);
  const input = updatePlanSchema.parse(request.body);
  const plan = await planService.update(id, request.user.id, input);
  return reply.send({ plan });
}

export async function deletePlanHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const { id } = planIdSchema.parse(request.params);
  await planService.delete(id, request.user.id);
  return reply.status(204).send();
}

export async function addMilestoneHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const { id } = planIdSchema.parse(request.params);
  const input = createMilestoneSchema.parse(request.body);
  const milestone = await planService.addMilestone(id, request.user.id, input);
  return reply.status(201).send({ milestone });
}

export async function updateMilestoneHandler(
  request: FastifyRequest<{ Params: { planId: string; milestoneId: string } }>,
  reply: FastifyReply
) {
  const { milestoneId } = request.params as { planId: string; milestoneId: string };
  const input = updateMilestoneSchema.parse(request.body);
  const milestone = await planService.updateMilestone(milestoneId, request.user.id, input);
  return reply.send({ milestone });
}

export async function deleteMilestoneHandler(
  request: FastifyRequest<{ Params: { planId: string; milestoneId: string } }>,
  reply: FastifyReply
) {
  const { milestoneId } = request.params as { planId: string; milestoneId: string };
  await planService.deleteMilestone(milestoneId, request.user.id);
  return reply.status(204).send();
}

export async function completeMilestoneHandler(
  request: FastifyRequest<{ Params: { planId: string; milestoneId: string } }>,
  reply: FastifyReply
) {
  const { milestoneId } = request.params as { planId: string; milestoneId: string };
  
  const milestone = await planService.completeMilestone(milestoneId, request.user.id);
  
  return reply.send({ milestone });
}

export async function reorderMilestonesHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const { id } = planIdSchema.parse(request.params);
  const input = reorderMilestonesSchema.parse(request.body);
  const plan = await planService.reorderMilestones(id, request.user.id, input.milestones);
  return reply.send({ plan });
}

export async function linkBudgetHandler(
  request: FastifyRequest<{ Params: { id: string; budgetId: string } }>,
  reply: FastifyReply
) {
  const { id, budgetId } = planIdSchema.parse({ ...request.params, ...request.query } as any);
  const planBudget = await planService.linkBudget(id, request.user.id, budgetId);
  return reply.status(201).send({ planBudget });
}

export async function linkGoalHandler(
  request: FastifyRequest<{ Params: { id: string; goalId: string } }>,
  reply: FastifyReply
) {
  const { id, goalId } = planIdSchema.parse({ ...request.params, ...request.query } as any);
  const planGoal = await planService.linkGoal(id, request.user.id, goalId);
  return reply.status(201).send({ planGoal });
}

export async function createBudgetsFromMilestonesHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const { id } = request.params as { id: string };
  const result = await planService.createBudgetsFromMilestones(id, request.user.id);
  return reply.status(201).send(result);
}
