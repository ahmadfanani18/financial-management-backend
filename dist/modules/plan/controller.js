import { planService } from './service.js';
import { createPlanSchema, updatePlanSchema, planIdSchema, createMilestoneSchema, updateMilestoneSchema, reorderMilestonesSchema } from './schemas.js';
export async function getPlansHandler(request, reply) {
    const plans = await planService.getAll(request.user.id);
    return reply.send({ plans });
}
export async function getPlanHandler(request, reply) {
    const { id } = planIdSchema.parse(request.params);
    const plan = await planService.getById(id, request.user.id);
    return reply.send({ plan });
}
export async function createPlanHandler(request, reply) {
    const input = createPlanSchema.parse(request.body);
    const plan = await planService.create(request.user.id, input);
    return reply.status(201).send({ plan });
}
export async function updatePlanHandler(request, reply) {
    const { id } = planIdSchema.parse(request.params);
    const input = updatePlanSchema.parse(request.body);
    const plan = await planService.update(id, request.user.id, input);
    return reply.send({ plan });
}
export async function deletePlanHandler(request, reply) {
    const { id } = planIdSchema.parse(request.params);
    await planService.delete(id, request.user.id);
    return reply.status(204).send();
}
export async function addMilestoneHandler(request, reply) {
    const { id } = planIdSchema.parse(request.params);
    const input = createMilestoneSchema.parse(request.body);
    const milestone = await planService.addMilestone(id, request.user.id, input);
    return reply.status(201).send({ milestone });
}
export async function updateMilestoneHandler(request, reply) {
    const { milestoneId } = request.params;
    const input = updateMilestoneSchema.parse(request.body);
    const milestone = await planService.updateMilestone(milestoneId, request.user.id, input);
    return reply.send({ milestone });
}
export async function deleteMilestoneHandler(request, reply) {
    const { milestoneId } = request.params;
    await planService.deleteMilestone(milestoneId, request.user.id);
    return reply.status(204).send();
}
export async function completeMilestoneHandler(request, reply) {
    const { milestoneId } = request.params;
    const milestone = await planService.completeMilestone(milestoneId, request.user.id);
    return reply.send({ milestone });
}
export async function reorderMilestonesHandler(request, reply) {
    const { id } = planIdSchema.parse(request.params);
    const input = reorderMilestonesSchema.parse(request.body);
    const plan = await planService.reorderMilestones(id, request.user.id, input.milestones);
    return reply.send({ plan });
}
export async function linkBudgetHandler(request, reply) {
    const { id, budgetId } = planIdSchema.parse({ ...request.params, ...request.query });
    const planBudget = await planService.linkBudget(id, request.user.id, budgetId);
    return reply.status(201).send({ planBudget });
}
export async function linkGoalHandler(request, reply) {
    const { id, goalId } = planIdSchema.parse({ ...request.params, ...request.query });
    const planGoal = await planService.linkGoal(id, request.user.id, goalId);
    return reply.status(201).send({ planGoal });
}
export async function createBudgetsFromMilestonesHandler(request, reply) {
    const { id } = request.params;
    const result = await planService.createBudgetsFromMilestones(id, request.user.id);
    return reply.status(201).send(result);
}
