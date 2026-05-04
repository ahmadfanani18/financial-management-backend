import { prisma } from '../../config/prisma.js';
import type { CreatePlanInput, UpdatePlanInput, CreateMilestoneInput, UpdateMilestoneInput } from './schemas.js';

export class PlanService {
  async getAll(userId: string) {
    return prisma.plan.findMany({
      where: { userId },
      include: { 
        milestones: { orderBy: { order: 'asc' }, include: { goal: true } },
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
        milestones: { orderBy: { order: 'asc' }, include: { goal: true } },
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

    const milestones = await prisma.planMilestone.findMany({
      where: { planId: id },
      select: { goalId: true },
    });

    const goalIds = milestones
      .filter(m => m.goalId)
      .map(m => m.goalId!);

    await prisma.goalContribution.deleteMany({
      where: { goalId: { in: goalIds } },
    });

    if (goalIds.length > 0) {
      await prisma.goal.deleteMany({
        where: { id: { in: goalIds } },
      });
    }

    await prisma.planMilestone.deleteMany({
      where: { planId: id },
    });

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

  async deleteMilestoneWithRefund(milestoneId: string, userId: string) {
    const milestone = await prisma.planMilestone.findFirst({
      where: { id: milestoneId, plan: { userId } },
      include: { 
        plan: true,
        goal: true,
      },
    });

    if (!milestone) {
      throw new Error('Milestone tidak ditemukan');
    }

    if (milestone.goalId && milestone.goal?.source === 'AUTO_GENERATED') {
      const { goalService } = await import('../goal/service.js');
      await goalService.deleteWithRefund(milestone.goalId, userId);
    } else {
      await prisma.planMilestone.delete({ where: { id: milestoneId } });
    }
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

  async createBudgetsFromMilestones(planId: string, userId: string) {
    const plan = await this.getById(planId, userId);

    const milestonesWithGoals = plan.milestones.filter(
      m => m.goalId && m.targetAmount && m.targetDate
    );

    if (milestonesWithGoals.length === 0) {
      throw new Error('Tidak ada milestone dengan goal dan target amount');
    }

    const firstMilestone = milestonesWithGoals[0];
    const goal = await prisma.goal.findUnique({
      where: { id: firstMilestone.goalId! },
    });

    if (!goal) throw new Error('Goal tidak ditemukan');

    const categoryName = `Tabungan - ${goal.name}`;
    let category = await prisma.category.findFirst({
      where: { userId, name: categoryName },
    });

    if (!category) {
      category = await prisma.category.create({
        data: {
          name: categoryName,
          type: 'EXPENSE',
          userId,
          color: goal.color || '#10B981',
          icon: goal.icon || 'target',
        },
      });
    }

    const createdBudgets = [];

    for (const milestone of milestonesWithGoals) {
      const targetDate = new Date(milestone.targetDate!);
      const startDate = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
      const endDate = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0);
      endDate.setHours(23, 59, 59, 999);

      const existingBudget = await prisma.budget.findFirst({
        where: {
          userId,
          categoryId: category.id,
          startDate: { gte: startDate },
          endDate: { lte: endDate },
          isActive: true,
        },
      });

      if (!existingBudget) {
        const budget = await prisma.budget.create({
          data: {
            userId,
            categoryId: category.id,
            amount: Number(milestone.targetAmount),
            period: 'MONTHLY',
            startDate,
            endDate,
            isActive: true,
            warningThreshold: 80,
          },
        });
        createdBudgets.push(budget);
      }
    }

    return {
      message: `${createdBudgets.length} budget berhasil dibuat`,
      budgets: createdBudgets,
    };
  }
}

export const planService = new PlanService();
