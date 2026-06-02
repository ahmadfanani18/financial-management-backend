import { prisma } from '../../config/prisma.js';
import type { CreateBudgetInput, UpdateBudgetInput } from './schemas.js';

function calculateEndDate(startDate: Date, period: string): Date {
  const start = new Date(startDate);
  switch (period) {
    case 'MONTHLY': {
      return new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59);
    }
    case 'WEEKLY': {
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      return end;
    }
    case 'YEARLY': {
      const end = new Date(start);
      end.setFullYear(end.getFullYear() + 1);
      end.setDate(end.getDate() - 1);
      end.setHours(23, 59, 59, 999);
      return end;
    }
    case 'CUSTOM':
    default:
      return start;
  }
}

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
    const startDate = new Date(input.startDate);
    const calculatedEndDate = calculateEndDate(startDate, input.period || 'MONTHLY');

    const existingBudgets = await prisma.budget.findMany({
      where: {
        userId,
        categoryId: input.categoryId,
        isActive: true,
      },
    });

    for (const budget of existingBudgets) {
      if (!budget.endDate) {
        const existingEndDate = calculateEndDate(new Date(budget.startDate), budget.period);
        await prisma.budget.update({
          where: { id: budget.id },
          data: { endDate: existingEndDate },
        });
      }
    }

    const allBudgets = await prisma.budget.findMany({
      where: {
        userId,
        categoryId: input.categoryId,
        isActive: true,
      },
    });

    for (const budget of allBudgets) {
      const existingStart = new Date(budget.startDate);
      const existingEnd = budget.endDate ? new Date(budget.endDate) : calculateEndDate(existingStart, budget.period);

      if (startDate <= existingEnd && calculatedEndDate >= existingStart) {
        const periodLabels: Record<string, string> = { MONTHLY: 'Bulanan', WEEKLY: 'Mingguan', YEARLY: 'Tahunan' };
        const periodLabel = periodLabels[budget.period] || budget.period;
        throw new Error(`Anggaran untuk kategori ini sudah ada pada periode ${periodLabel} (${existingStart.toLocaleDateString('id-ID')} - ${existingEnd.toLocaleDateString('id-ID')}). Tidak dapat membuat anggaran baru karena periode saling overlaps.`);
      }
    }

    return prisma.budget.create({
      data: { ...input, startDate, endDate: calculatedEndDate, userId },
      include: { category: true },
    });
  }

  async update(id: string, userId: string, input: UpdateBudgetInput) {
    const existing = await this.getById(id, userId);

    let endDate = existing.endDate;
    const newStartDate = input.startDate ? new Date(input.startDate) : new Date(existing.startDate);
    const newPeriod = input.period || existing.period;

    if (input.startDate || input.period) {
      endDate = calculateEndDate(newStartDate, newPeriod);
    }

    return prisma.budget.update({
      where: { id },
      data: { ...input, endDate },
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
