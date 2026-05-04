import { prisma } from '../../config/prisma.js';
import type { CreateGoalInput, UpdateGoalInput, ContributionInput } from './schemas.js';

export class GoalService {
  async getAll(userId: string) {
    return prisma.goal.findMany({
      where: { userId },
      include: { contributions: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getById(id: string, userId: string) {
    const goal = await prisma.goal.findFirst({
      where: { id, userId },
      include: { contributions: { orderBy: { date: 'desc' } } },
    });
    if (!goal) throw new Error('Target tabungan tidak ditemukan');
    return goal;
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
}

export const goalService = new GoalService();
