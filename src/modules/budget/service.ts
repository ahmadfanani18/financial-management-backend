import { prisma } from '../../config/prisma.js';
import type { CreateBudgetInput, UpdateBudgetInput } from './schemas.js';

export class BudgetService {
  async getAll(userId: string) {
    return prisma.budget.findMany({
      where: { userId },
      include: { category: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getById(id: string, userId: string) {
    const budget = await prisma.budget.findFirst({
      where: { id, userId },
      include: { category: true },
    });
    if (!budget) throw new Error('Anggaran tidak ditemukan');
    return budget;
  }

  async create(userId: string, input: CreateBudgetInput) {
    const existing = await prisma.budget.findFirst({
      where: {
        userId,
        categoryId: input.categoryId,
        isActive: true,
      },
    });
    
    if (existing) {
      throw new Error('Anggaran untuk kategori ini sudah ada');
    }

    return prisma.budget.create({
      data: { ...input, userId },
      include: { category: true },
    });
  }

  async update(id: string, userId: string, input: UpdateBudgetInput) {
    await this.getById(id, userId);
    return prisma.budget.update({
      where: { id },
      data: input,
      include: { category: true },
    });
  }

  async updateSpent(id: string, userId: string, spent: number) {
    await this.getById(id, userId);
    return prisma.budget.update({
      where: { id },
      data: { spent },
      include: { category: true },
    });
  }

  async delete(id: string, userId: string) {
    await this.getById(id, userId);
    await prisma.budget.delete({ where: { id } });
  }

  async getSpending(userId: string, budgetId: string) {
    const budget = await this.getById(budgetId, userId);
    
    const startDate = new Date(budget.startDate);
    const endDate = budget.endDate || new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);
    
    const transactions = await prisma.transaction.findMany({
      where: {
        userId,
        categoryId: budget.categoryId,
        type: 'EXPENSE',
        date: { gte: startDate, lte: endDate },
      },
    });
    
    const spent = transactions.reduce((sum, t) => sum + Number(t.amount), 0);
    const percentage = Number(budget.amount) > 0 ? (spent / Number(budget.amount)) * 100 : 0;
    
    return {
      budget,
      spent,
      remaining: Number(budget.amount) - spent,
      percentage: Math.round(percentage),
      isOverBudget: spent > Number(budget.amount),
      isWarning: percentage >= budget.warningThreshold && !budget.endDate,
    };
  }

  async getAllWithSpending(userId: string) {
    const budgets = await this.getAll(userId);
    
    const results = await Promise.all(
      budgets.map(async (budget) => {
        const startDate = new Date(budget.startDate);
        const endDate = budget.endDate || new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);
        
        const transactions = await prisma.transaction.findMany({
          where: {
            userId,
            categoryId: budget.categoryId,
            type: 'EXPENSE',
            date: { gte: startDate, lte: endDate },
          },
        });
        
        console.log('Budget:', budget.categoryId, 'Category:', budget.category?.name);
        console.log('Transactions found:', transactions.length);
        console.log('Start date:', startDate, 'End date:', endDate);
        
        const spent = transactions.reduce((sum, t) => sum + Number(t.amount), 0);
        const percentage = Number(budget.amount) > 0 ? (spent / Number(budget.amount)) * 100 : 0;
        
        return {
          ...budget,
          spent,
          remaining: Number(budget.amount) - spent,
          percentage: Math.round(percentage),
          isOverBudget: spent > Number(budget.amount),
          isWarning: percentage >= budget.warningThreshold,
        };
      })
    );
    
    return results;
  }

  async getSummary(userId: string) {
    const budgetsWithSpending = await this.getAllWithSpending(userId);
    
    const totalBudget = budgetsWithSpending.reduce((sum, b) => sum + Number(b.amount), 0);
    const totalSpent = budgetsWithSpending.reduce((sum, b) => sum + b.spent, 0);
    
    return {
      totalBudget,
      totalSpent,
      remaining: totalBudget - totalSpent,
      budgetCount: budgetsWithSpending.length,
    };
  }
}

export const budgetService = new BudgetService();
