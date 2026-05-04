import { prisma } from '../../config/prisma.js';
import type { CreateGoalInput, UpdateGoalInput, ContributionInput, ContributionWithAccountInput, CreateGoalFromMilestoneInput } from './schemas.js';

export class GoalService {
  async getAll(userId: string) {
    const goals = await prisma.goal.findMany({
      where: { userId },
      include: { contributions: true },
      orderBy: { createdAt: 'desc' },
    });
    
    return goals.map(goal => ({
      ...goal,
      targetAmount: Number(goal.targetAmount),
      currentAmount: Number(goal.currentAmount),
      contributions: goal.contributions.map(c => ({
        ...c,
        amount: Number(c.amount),
      })),
    }));
  }

  async getOverview(userId: string) {
    const goals = await prisma.goal.findMany({
      where: { userId },
      select: { targetAmount: true, currentAmount: true },
    });
    
    const totalTarget = goals.reduce((sum, g) => sum + Number(g.targetAmount), 0);
    const totalSaved = goals.reduce((sum, g) => sum + Number(g.currentAmount), 0);
    
    return {
      totalTarget,
      totalSaved,
      progress: totalTarget > 0 ? Math.round((totalSaved / totalTarget) * 100) : 0,
    };
  }

  async getById(id: string, userId: string) {
    const goal = await prisma.goal.findFirst({
      where: { id, userId },
      include: { contributions: { orderBy: { date: 'desc' } } },
    });
    if (!goal) throw new Error('Target tabungan tidak ditemukan');
    
    return {
      ...goal,
      targetAmount: Number(goal.targetAmount),
      currentAmount: Number(goal.currentAmount),
      contributions: goal.contributions.map(c => ({
        ...c,
        amount: Number(c.amount),
      })),
    };
  }

  async create(userId: string, input: CreateGoalInput) {
    return prisma.goal.create({
      data: { ...input, userId },
    });
  }

  async update(id: string, userId: string, input: UpdateGoalInput) {
    const goal = await this.getById(id, userId);
    
    if (goal.isLocked) {
      if (input.targetAmount !== undefined || input.deadline !== undefined || input.icon !== undefined || input.color !== undefined) {
        throw new Error('Goal terkunci - hanya nama yang bisa diubah');
      }
    }
    
    return prisma.goal.update({
      where: { id },
      data: input,
    });
  }

  async delete(id: string, userId: string) {
    await this.getById(id, userId);
    await prisma.goal.delete({ where: { id } });
  }

  async toggleLock(id: string, userId: string) {
    const goal = await this.getById(id, userId);
    return prisma.goal.update({
      where: { id },
      data: { isLocked: !goal.isLocked },
    });
  }

  async deleteWithTransaction(id: string, userId: string, accountId?: string) {
    const goal = await this.getById(id, userId);
    
    return prisma.$transaction(async (tx) => {
      const contributions = await tx.goalContribution.findMany({
        where: { goalId: id },
      });
      
      const totalContributions = contributions.reduce(
        (sum, c) => sum + Number(c.amount),
        0
      );

      if (totalContributions > 0 && accountId) {
        let category = await tx.category.findFirst({
          where: { userId, name: 'Goals', type: 'INCOME' },
        });

        if (!category) {
          category = await tx.category.create({
            data: {
              userId,
              name: 'Goals',
              type: 'INCOME',
              icon: 'target',
              color: '#10B981',
              isDefault: true,
            },
          });
        }

        await tx.transaction.create({
          data: {
            userId,
            accountId,
            categoryId: category.id,
            type: 'INCOME',
            amount: totalContributions,
            description: `Pengembalian dana dari goal: ${goal.name}`,
            date: new Date(),
          },
        });

        await tx.account.update({
          where: { id: accountId },
          data: { balance: { increment: totalContributions } },
        });
      }

      await tx.goalContribution.deleteMany({ where: { goalId: id } });
      await tx.goal.delete({ where: { id } });
    });
  }

  async getContributions(id: string, userId: string) {
    await this.getById(id, userId);
    return prisma.goalContribution.findMany({
      where: { goalId: id },
      orderBy: { date: 'desc' },
    });
  }

  async addContribution(id: string, userId: string, input: ContributionInput, accountId?: string) {
    const goal = await this.getById(id, userId);
    
    return prisma.$transaction(async (tx) => {
      const contribution = await tx.goalContribution.create({
        data: {
          goalId: id,
          amount: input.amount,
          date: input.date,
          note: input.note,
        },
      });

      await tx.goal.update({
        where: { id },
        data: { currentAmount: { increment: input.amount } },
      });

      if (accountId) {
        let category = await tx.category.findFirst({
          where: { userId, name: 'Goals', type: 'EXPENSE' },
        });

        if (!category) {
          category = await tx.category.create({
            data: {
              userId,
              name: 'Goals',
              type: 'EXPENSE',
              icon: 'target',
              color: '#10B981',
              isDefault: true,
            },
          });
        }

        await tx.transaction.create({
          data: {
            userId,
            accountId,
            categoryId: category.id,
            type: 'EXPENSE',
            amount: input.amount,
            description: `Kontribusi ke goal: ${goal.name}`,
            date: input.date,
          },
        });

        await tx.account.update({
          where: { id: accountId },
          data: { balance: { decrement: input.amount } },
        });
      }

      const updatedGoal = await tx.goal.findUnique({ where: { id } });
      
      if (updatedGoal && updatedGoal.currentAmount >= updatedGoal.targetAmount && goal.status === 'ACTIVE') {
        await tx.goal.update({
          where: { id },
          data: { status: 'COMPLETED' },
        });
      }

      return { contribution, goal: updatedGoal };
    });
  }

  async getProgress(id: string, userId: string) {
    const goal = await this.getById(id, userId);
    const percentage = Number(goal.targetAmount) > 0 
      ? (Number(goal.currentAmount) / Number(goal.targetAmount)) * 100 
      : 0;
    
    const daysRemaining = Math.ceil((new Date(goal.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    const suggestedMonthly = daysRemaining > 0 
      ? (Number(goal.targetAmount) - Number(goal.currentAmount)) / (daysRemaining / 30) 
      : 0;

    return {
      ...goal,
      percentage: Math.round(percentage),
      daysRemaining: Math.max(0, daysRemaining),
      suggestedMonthly: Math.round(suggestedMonthly),
      isCompleted: goal.currentAmount >= goal.targetAmount,
      isOverdue: daysRemaining < 0 && goal.status === 'ACTIVE',
    };
  }

  async getAllWithProgress(userId: string) {
    const goals = await this.getAll(userId);
    
    return goals.map(goal => {
      const percentage = Number(goal.targetAmount) > 0 
        ? (Number(goal.currentAmount) / Number(goal.targetAmount)) * 100 
        : 0;
      
      const daysRemaining = Math.ceil((new Date(goal.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      
      return {
        ...goal,
        percentage: Math.round(percentage),
        daysRemaining: Math.max(0, daysRemaining),
        isCompleted: goal.currentAmount >= goal.targetAmount,
        isOverdue: daysRemaining < 0 && goal.status === 'ACTIVE',
      };
    });
  }

  async createFromMilestone(milestoneId: string, userId: string, input?: CreateGoalFromMilestoneInput) {
    const milestone = await prisma.planMilestone.findFirst({
      where: { id: milestoneId, plan: { userId } },
      include: { plan: true },
    });
    
    if (!milestone || !milestone.targetAmount) {
      throw new Error('Milestone tidak ditemukan atau tidak memiliki target amount');
    }

    const goal = await prisma.goal.create({
      data: {
        userId,
        name: input?.name || milestone.title,
        targetAmount: input?.targetAmount || milestone.targetAmount,
        deadline: input?.deadline ? new Date(input.deadline) : milestone.targetDate,
        currentAmount: 0,
        source: 'AUTO_GENERATED',
        sourceMilestoneId: milestoneId,
        icon: input?.icon || 'target',
        color: input?.color || '#10B981',
      },
    });

    await prisma.planMilestone.update({
      where: { id: milestoneId },
      data: { goalId: goal.id },
    });

    return goal;
  }

  async createContribution(goalId: string, userId: string, input: ContributionWithAccountInput) {
    const goal = await this.getById(goalId, userId);
    const accountId = input.accountId && input.accountId.trim() ? input.accountId.trim() : null;
    const categoryId = input.categoryId && input.categoryId.trim() ? input.categoryId.trim() : null;
    
    const contribution = await prisma.$transaction(async (tx) => {
      const newContribution = await tx.goalContribution.create({
        data: {
          goalId,
          amount: input.amount,
          date: input.date,
          note: input.note,
          accountId: accountId,
          categoryId: categoryId,
        },
      });

      await tx.goal.update({
        where: { id: goalId },
        data: {
          currentAmount: { increment: input.amount },
        },
      });

      if (accountId) {
        await tx.account.update({
          where: { id: accountId },
          data: {
            balance: { decrement: input.amount },
          },
        });
      }

      return newContribution;
    });

    return contribution;
  }

  async deleteWithRefund(goalId: string, userId: string) {
    const goal = await this.getById(goalId, userId);
    
    if (goal.source !== 'AUTO_GENERATED') {
      throw new Error('Hanya goal yang dibuat dari milestone yang dapat dihapus dengan refund');
    }

    const contributions = await prisma.goalContribution.findMany({
      where: { goalId, accountId: { not: null } },
    });

    await prisma.$transaction(async (tx) => {
      for (const contribution of contributions) {
        if (contribution.accountId) {
          await tx.transaction.create({
            data: {
              userId,
              accountId: contribution.accountId,
              type: 'INCOME',
              amount: contribution.amount,
              description: `Refund dari goal: ${goal.name}`,
              date: new Date(),
            },
          });

          await tx.account.update({
            where: { id: contribution.accountId },
            data: {
              balance: { increment: contribution.amount },
            },
          });
        }
      }

      await tx.goalContribution.deleteMany({ where: { goalId } });
    });

    if (goal.sourceMilestoneId) {
      await prisma.planMilestone.update({
        where: { id: goal.sourceMilestoneId },
        data: { goalId: null },
      });
    }

    await prisma.goal.delete({ where: { id: goalId } });
  }

  async syncFromMilestoneComplete(milestoneId: string, userId: string) {
    const milestone = await prisma.planMilestone.findFirst({
      where: { id: milestoneId, plan: { userId }, goalId: { not: null } },
      include: { plan: true },
    });

    if (!milestone?.goalId) return null;

    if (milestone.targetAmount) {
      await this.createContribution(milestone.goalId, userId, {
        amount: Number(milestone.targetAmount),
        date: new Date(),
        note: `Completed milestone: ${milestone.title}`,
        accountId: undefined,
        categoryId: undefined,
      });
    }

    return await this.getProgress(milestone.goalId, userId);
  }
}

export const goalService = new GoalService();
