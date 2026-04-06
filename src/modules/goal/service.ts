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
    await this.getById(id, userId);
    return prisma.goal.update({
      where: { id },
      data: input,
    });
  }

  async delete(id: string, userId: string) {
    await this.getById(id, userId);
    await prisma.goal.delete({ where: { id } });
  }

  async addContribution(id: string, userId: string, input: ContributionInput) {
    const goal = await this.getById(id, userId);
    
    const contribution = await prisma.goalContribution.create({
      data: {
        goalId: id,
        amount: input.amount,
        date: input.date,
        note: input.note,
      },
    });

    await prisma.goal.update({
      where: { id },
      data: { currentAmount: { increment: input.amount } },
    });

    const updatedGoal = await this.getById(id, userId);
    
    if (updatedGoal.currentAmount >= updatedGoal.targetAmount && goal.status === 'ACTIVE') {
      await prisma.goal.update({
        where: { id },
        data: { status: 'COMPLETED' },
      });
    }

    return { contribution, goal: updatedGoal };
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
