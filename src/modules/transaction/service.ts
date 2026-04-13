import { prisma } from '../../config/prisma.js';
import type { CreateTransactionInput, UpdateTransactionInput, TransactionQuery } from './schemas.js';

const VALID_TYPES = ['INCOME', 'EXPENSE', 'TRANSFER'];

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

  async create(userId: string, input: CreateTransactionInput) {
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
