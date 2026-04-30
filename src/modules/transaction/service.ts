import { prisma } from '../../config/prisma.js';
import type { CreateTransactionInput, UpdateTransactionInput, TransactionQuery } from './schemas.js';

const VALID_TYPES = ['INCOME', 'EXPENSE', 'TRANSFER'];

function calculateBudgetEndDate(startDate: Date, period: string): Date {
  const start = new Date(startDate);
  switch (period) {
    case 'MONTHLY':
      return new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59);
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
    default:
      return start;
  }
}

export class TransactionService {
  async getAll(userId: string, query: TransactionQuery) {
    const where: any = { userId };
    
    if (query.accountId) where.accountId = query.accountId;
    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.type && VALID_TYPES.includes(query.type)) where.type = query.type;
    if (query.startDate && query.endDate) {
      where.date = { gte: query.startDate, lte: query.endDate };
    }
    if (query.minAmount || query.maxAmount) {
      where.amount = {};
      if (query.minAmount) where.amount.gte = query.minAmount;
      if (query.maxAmount) where.amount.lte = query.maxAmount;
    }
    if (query.search) {
      where.description = { contains: query.search, mode: 'insensitive' };
    }

    const skip = (query.page - 1) * query.limit;
    
    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: { date: 'desc' },
        include: {
          account: true,
          category: true,
          fromAccount: true,
          toAccount: true,
          tags: { include: { tag: true } },
        },
      }),
      prisma.transaction.count({ where }),
    ]);

    return {
      transactions: transactions.map(t => ({
        ...t,
        tags: t.tags.map(t => t.tag),
      })),
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit),
    };
  }

  async getById(id: string, userId: string) {
    const transaction = await prisma.transaction.findFirst({
      where: { id, userId },
      include: {
        account: true,
        category: true,
        fromAccount: true,
        toAccount: true,
        tags: { include: { tag: true } },
      },
    });
    if (!transaction) throw new Error('Transaksi tidak ditemukan');
    return { ...transaction, tags: transaction.tags.map(t => t.tag) };
  }

  async validateCategoryForExpense(userId: string, categoryId: string, date: Date) {
    const budgets = await prisma.budget.findMany({
      where: {
        userId,
        categoryId,
        isActive: true,
      },
    });

    if (budgets.length === 0) {
      throw new Error('Kategori ini belum memiliki budget. Buat budget terlebih dahulu sebelum membuat transaksi pengeluaran.');
    }

    const transactionDate = new Date(date);
    let validBudget = null;

    for (const budget of budgets) {
      const startDate = new Date(budget.startDate);
      const endDate = budget.endDate ? new Date(budget.endDate) : calculateBudgetEndDate(startDate, budget.period);

      if (transactionDate >= startDate && transactionDate <= endDate) {
        validBudget = budget;
        break;
      }
    }

    if (!validBudget) {
      const periods = budgets.map(b => {
        const s = new Date(b.startDate);
        const e = b.endDate ? new Date(b.endDate) : calculateBudgetEndDate(s, b.period);
        return `${s.toLocaleDateString('id-ID')} - ${e.toLocaleDateString('id-ID')}`;
      }).join(', ');
      throw new Error(`Transaksi pada tanggal ${transactionDate.toLocaleDateString('id-ID')} tidak berada dalam periode budget aktif (${periods}).`);
    }

    const startDate = new Date(validBudget.startDate);
    const endDate = validBudget.endDate ? new Date(validBudget.endDate) : calculateBudgetEndDate(startDate, validBudget.period);
    const periodLabels: Record<string, string> = { MONTHLY: 'Bulanan', WEEKLY: 'Mingguan', YEARLY: 'Tahunan' };
    const periodLabel = periodLabels[validBudget.period] || validBudget.period;

    if (transactionDate < startDate || transactionDate > endDate) {
      throw new Error(`Transaksi berada di luar periode budget ${periodLabel} (${startDate.toLocaleDateString('id-ID')} - ${endDate.toLocaleDateString('id-ID')}).`);
    }

    return validBudget;
  }

  async create(userId: string, input: CreateTransactionInput) {
    if (input.type === 'EXPENSE' && input.categoryId) {
      await this.validateCategoryForExpense(userId, input.categoryId, new Date(input.date));
    }

    const { tagIds, ...data } = input;
    
    const transaction = await prisma.transaction.create({
      data: {
        ...data,
        userId,
      },
    });

    if (tagIds?.length) {
      await prisma.transactionTag.createMany({
        data: tagIds.map(tagId => ({
          transactionId: transaction.id,
          tagId,
        })),
      });
    }

    if (input.type === 'INCOME' || input.type === 'EXPENSE') {
      const adjustment = input.type === 'INCOME' ? input.amount : -input.amount;
      await prisma.account.update({
        where: { id: input.accountId },
        data: { balance: { increment: adjustment } },
      });
    }

    if (input.type === 'TRANSFER' && input.fromAccountId && input.toAccountId) {
      await prisma.account.update({
        where: { id: input.fromAccountId },
        data: { balance: { decrement: input.amount } },
      });
      await prisma.account.update({
        where: { id: input.toAccountId },
        data: { balance: { increment: input.amount } },
      });
    }

    return this.getById(transaction.id, userId);
  }

  async update(id: string, userId: string, input: UpdateTransactionInput) {
    const existing = await this.getById(id, userId);
    const { tagIds, ...data } = input;

    await prisma.transaction.update({
      where: { id },
      data,
    });

    if (tagIds) {
      await prisma.transactionTag.deleteMany({ where: { transactionId: id } });
      await prisma.transactionTag.createMany({
        data: tagIds.map(tagId => ({
          transactionId: id,
          tagId,
        })),
      });
    }

    return this.getById(id, userId);
  }

  async delete(id: string, userId: string) {
    const transaction = await this.getById(id, userId);

    if (transaction.type === 'INCOME' || transaction.type === 'EXPENSE') {
      const adjustment = transaction.type === 'INCOME' ? -transaction.amount : transaction.amount;
      await prisma.account.update({
        where: { id: transaction.accountId },
        data: { balance: { increment: adjustment } },
      });
    }

    if (transaction.type === 'TRANSFER' && transaction.fromAccountId && transaction.toAccountId) {
      await prisma.account.update({
        where: { id: transaction.fromAccountId },
        data: { balance: { increment: transaction.amount } },
      });
      await prisma.account.update({
        where: { id: transaction.toAccountId },
        data: { balance: { decrement: transaction.amount } },
      });
    }

    await prisma.transaction.delete({ where: { id } });
  }

  async getRecent(userId: string, limit: number = 5) {
    return prisma.transaction.findMany({
      where: { userId },
      take: limit,
      orderBy: { date: 'desc' },
      include: {
        account: true,
        category: true,
      },
    });
  }

  async getSummary(userId: string, startDate: Date, endDate: Date) {
    const transactions = await prisma.transaction.findMany({
      where: {
        userId,
        date: { gte: startDate, lte: endDate },
      },
    });

    const income = transactions
      .filter(t => t.type === 'INCOME')
      .reduce((sum, t) => sum + Number(t.amount.toString()), 0);

    const expense = transactions
      .filter(t => t.type === 'EXPENSE')
      .reduce((sum, t) => sum + Number(t.amount.toString()), 0);

    return { income, expense, balance: income - expense };
  }
}

export const transactionService = new TransactionService();
