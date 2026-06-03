import { prisma } from '../../config/prisma.js';
import { startOfMonth, endOfMonth, differenceInMonths } from 'date-fns';
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
      include: {
        contributions: { orderBy: { date: 'desc' } },
        linkedAccount: {
          select: { id: true, name: true, balance: true },
        },
      },
    });
    if (!goal) throw new Error('Target tabungan tidak ditemukan');
    
    return {
      ...goal,
      targetAmount: Number(goal.targetAmount),
      currentAmount: Number(goal.currentAmount),
      initialBalance: goal.initialBalance ? Number(goal.initialBalance) : 0,
      contributions: goal.contributions.map(c => ({
        ...c,
        amount: Number(c.amount),
        type: c.type,
      })),
    };
  }

  async create(userId: string, input: CreateGoalInput) {
    const { createBudget, monthlyAmount, linkedAccountId, ...goalData } = input;

    let initialBalance = 0;
    let isInitialSet = false;

    if (linkedAccountId) {
      const account = await prisma.account.findFirst({
        where: { id: linkedAccountId, userId },
      });
      if (account) {
        initialBalance = Number(account.balance);
        isInitialSet = true;
      }
    }

    const goal = await prisma.goal.create({
      data: {
        name: goalData.name,
        targetAmount: goalData.targetAmount,
        deadline: goalData.deadline,
        icon: goalData.icon,
        color: goalData.color,
        userId,
        linkedAccountId,
        initialBalance,
        currentAmount: initialBalance,
        isInitialSet,
      },
    });

    if (isInitialSet && initialBalance > 0) {
      await prisma.goalContribution.create({
        data: {
          goalId: goal.id,
          amount: initialBalance,
          accountId: linkedAccountId,
          type: 'INITIAL',
          note: 'Saldo awal dari akun',
          date: new Date(),
        },
      });
    }

    if (createBudget && monthlyAmount && monthlyAmount > 0) {
      await this.createBudgetsForGoal(goal.id, monthlyAmount, goal.userId, goal.name, goal.color, goal.icon);
    }

    return goal;
  }

  private async createBudgetsForGoal(
    goalId: string,
    monthlyAmount: number,
    userId: string,
    goalName: string,
    goalColor: string,
    goalIcon: string
  ) {
    const goal = await prisma.goal.findUnique({ where: { id: goalId } });
    const now = new Date();
    const deadline = new Date(goal!.deadline);
    const monthsRemaining = differenceInMonths(deadline, now);

    if (monthsRemaining <= 0) return;

    const categoryName = `Tabungan - ${goalName}`;
    let category = await prisma.category.findFirst({
      where: { userId, name: categoryName },
    });

    if (!category) {
      category = await prisma.category.create({
        data: {
          name: categoryName,
          type: 'EXPENSE',
          userId,
          color: goalColor || '#10B981',
          icon: goalIcon || 'target',
        },
      });
    }

    const budgets = [];
    for (let i = 0; i <= monthsRemaining; i++) {
      const startDate = startOfMonth(new Date(now.getFullYear(), now.getMonth() + i, 1));
      const endDate = endOfMonth(new Date(now.getFullYear(), now.getMonth() + i, 1));

      budgets.push({
        userId,
        categoryId: category.id,
        amount: monthlyAmount,
        period: 'MONTHLY' as const,
        startDate,
        endDate,
        isActive: true,
        warningThreshold: 80,
      });
    }

    await prisma.budget.createMany({ data: budgets });
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

        const transaction = await tx.transaction.create({
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

        await tx.goalContribution.update({
          where: { id: contribution.id },
          data: { sourceTransactionId: transaction.id },
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

  async deleteWithRefund(goalId: string, userId: string, refundAccountId?: string) {
    const goal = await this.getById(goalId, userId);
    
    const currentAmount = Number(goal.currentAmount);
    const initialBalance = Number(goal.initialBalance) || 0;
    const refundAmount = currentAmount - initialBalance;

    const linkedAccountId = goal.linkedAccountId;
    const targetAccountId = refundAccountId || linkedAccountId;

    await prisma.$transaction(async (tx) => {
      if (refundAmount > 0 && targetAccountId) {
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
            accountId: targetAccountId,
            categoryId: category.id,
            type: 'INCOME',
            amount: refundAmount,
            description: `Refund dari hapus goal: ${goal.name}`,
            date: new Date(),
          },
        });

        await tx.account.update({
          where: { id: targetAccountId },
          data: { balance: { increment: refundAmount } },
        });
      }

      await tx.goalContribution.deleteMany({ where: { goalId } });
    });

    if (goal.sourceMilestoneId) {
      const milestoneExists = await prisma.planMilestone.findUnique({
        where: { id: goal.sourceMilestoneId },
      });
      if (milestoneExists) {
        await prisma.planMilestone.update({
          where: { id: goal.sourceMilestoneId },
          data: { goalId: null },
        });
      }
    }

    await prisma.goal.delete({ where: { id: goalId } });

    return { success: true, refundedAmount: refundAmount };
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

  async deleteContribution(goalId: string, contributionId: string, userId: string) {
    const goal = await this.getById(goalId, userId);
    
    const contribution = await prisma.goalContribution.findFirst({
      where: { id: contributionId, goalId: goalId },
    });
    
    if (!contribution) {
      throw new Error('Contribution tidak ditemukan');
    }
    
    if (contribution.type === 'INITIAL') {
      throw new Error('Contribution awal tidak bisa dihapus');
    }
    
    return prisma.$transaction(async (tx) => {
      await tx.goal.update({
        where: { id: goalId },
        data: { currentAmount: { decrement: contribution.amount } },
      });
      
      const updatedGoal = await tx.goal.findUnique({ where: { id: goalId } });
      if (updatedGoal && updatedGoal.status === 'COMPLETED') {
        await tx.goal.update({
          where: { id: goalId },
          data: { status: 'ACTIVE' },
        });
      }
      
      if (contribution.accountId) {
        await tx.account.update({
          where: { id: contribution.accountId },
          data: { balance: { increment: contribution.amount } },
        });
      }
      
      if (contribution.sourceTransactionId) {
        const sourceTx = await tx.transaction.findUnique({
          where: { id: contribution.sourceTransactionId },
        });
        if (sourceTx && sourceTx.type === 'EXPENSE') {
          await tx.account.update({
            where: { id: sourceTx.accountId },
            data: { balance: { increment: sourceTx.amount } },
          });
        }
        if (sourceTx) {
          await tx.transaction.delete({ where: { id: contribution.sourceTransactionId } });
        }
      }
      
      await tx.goalContribution.delete({ where: { id: contributionId } });
      
      return { success: true, goal: updatedGoal };
    });
  }
}

export const goalService = new GoalService();
