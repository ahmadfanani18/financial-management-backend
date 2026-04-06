import { prisma } from '../../config/prisma.js';
import type { CreatePlanInput, UpdatePlanInput, CreateMilestoneInput, UpdateMilestoneInput } from './schemas.js';

export class PlanService {
  async getAll(userId: string) {
    return prisma.plan.findMany({
      where: { userId },
      include: { 
        milestones: { orderBy: { order: 'asc' } },
        planBudgets: { include: { budget: { include: { category: true } } } },
        planGoals: { include: { goal: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getById(id: string, userId: string) {
    const plan = await prisma.plan.findFirst({
      where: { id, userId },
      include: { 
        milestones: { orderBy: { order: 'asc' } },
        planBudgets: { include: { budget: { include: { category: true } } } },
        planGoals: { include: { goal: true } },
      },
    });
    if (!plan) throw new Error('Rencana tidak ditemukan');
    return plan;
  }

  async create(userId: string, input: CreatePlanInput) {
    return prisma.plan.create({
      data: { ...input, userId },
      include: { milestones: true },
    });
  }

  async update(id: string, userId: string, input: UpdatePlanInput) {
    await this.getById(id, userId);
    return prisma.plan.update({
      where: { id },
      data: input,
      include: { milestones: { orderBy: { order: 'asc' } } },
    });
  }

  async delete(id: string, userId: string) {
    await this.getById(id, userId);
    await prisma.plan.delete({ where: { id } });
  }

  async addMilestone(planId: string, userId: string, input: CreateMilestoneInput) {
    await this.getById(planId, userId);
    
    const lastMilestone = await prisma.planMilestone.findFirst({
      where: { planId },
      orderBy: { order: 'desc' },
    });
    
    const order = lastMilestone ? lastMilestone.order + 1 : 0;
    
    return prisma.planMilestone.create({
      data: { ...input, planId, order },
    });
  }

  async updateMilestone(milestoneId: string, userId: string, input: UpdateMilestoneInput) {
    const milestone = await prisma.planMilestone.findFirst({
      where: { id: milestoneId, plan: { userId } },
    });
    if (!milestone) throw new Error('Milestone tidak ditemukan');
    
    return prisma.planMilestone.update({
      where: { id: milestoneId },
      data: input,
    });
  }

  async deleteMilestone(milestoneId: string, userId: string) {
    const milestone = await prisma.planMilestone.findFirst({
      where: { id: milestoneId, plan: { userId } },
    });
    if (!milestone) throw new Error('Milestone tidak ditemukan');
    
    await prisma.planMilestone.delete({ where: { id: milestoneId } });
  }

  async completeMilestone(milestoneId: string, userId: string) {
    const milestone = await prisma.planMilestone.findFirst({
      where: { id: milestoneId, plan: { userId } },
    });
    if (!milestone) throw new Error('Milestone tidak ditemukan');
    
    return prisma.planMilestone.update({
      where: { id: milestoneId },
      data: { isCompleted: true, completedAt: new Date() },
    });
  }

  async reorderMilestones(planId: string, userId: string, milestones: { id: string; order: number }[]) {
    await this.getById(planId, userId);
    
    await Promise.all(
      milestones.map(m => 
        prisma.planMilestone.update({
          where: { id: m.id },
          data: { order: m.order },
        })
      )
    );
    
    return this.getById(planId, userId);
  }

  async linkBudget(planId: string, userId: string, budgetId: string) {
    await this.getById(planId, userId);
    
    const budget = await prisma.budget.findFirst({
      where: { id: budgetId, userId },
    });
    if (!budget) throw new Error('Anggaran tidak ditemukan');
    
    return prisma.planBudget.create({
      data: { planId, budgetId },
    });
  }

  async unlinkBudget(planId: string, userId: string, budgetId: string) {
    await this.getById(planId, userId);
    
    await prisma.planBudget.deleteMany({
      where: { planId, budgetId },
    });
  }

  async linkGoal(planId: string, userId: string, goalId: string) {
    await this.getById(planId, userId);
    
    const goal = await prisma.goal.findFirst({
      where: { id: goalId, userId },
    });
    if (!goal) throw new Error('Target tabungan tidak ditemukan');
    
    return prisma.planGoal.create({
      data: { planId, goalId },
    });
  }

  async unlinkGoal(planId: string, userId: string, goalId: string) {
    await this.getById(planId, userId);
    
    await prisma.planGoal.deleteMany({
      where: { planId, goalId },
    });
  }
}

export const planService = new PlanService();
