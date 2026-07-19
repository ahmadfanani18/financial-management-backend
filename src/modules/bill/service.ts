import { prisma } from '../../config/prisma.js';
import type { CreateBillInput, UpdateBillInput } from './schemas.js';

export class BillService {
  async getAll(userId: string) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const bills = await prisma.bill.findMany({
      where: { userId },
      include: {
        account: true,
        category: true,
        transactions: {
          where: { date: { gte: startOfMonth, lte: endOfMonth } },
          orderBy: { date: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return bills.map((bill) => {
      const lastTransaction = bill.transactions[0];

      const dueDateOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), bill.dueDate);
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const lastPaidThisMonth = bill.lastPaidAt && bill.lastPaidAt >= startOfMonth && bill.lastPaidAt <= endOfMonth;

      let status: 'PAID' | 'PENDING' | 'OVERDUE';
      if (lastTransaction || lastPaidThisMonth) {
        status = 'PAID';
      } else if (now >= dueDateOfCurrentMonth) {
        status = 'OVERDUE';
      } else {
        status = 'PENDING';
      }

      return {
        ...bill,
        status,
        lastTransaction,
      };
    });
  }

  async getById(id: string, userId: string) {
    const bill = await prisma.bill.findFirst({
      where: { id, userId },
      include: { account: true, category: true },
    });
    if (!bill) throw new Error('Tagihan tidak ditemukan');
    return bill;
  }

  async create(userId: string, input: CreateBillInput) {
    return prisma.bill.create({
      data: { ...input, userId },
      include: { account: true, category: true },
    });
  }

  async update(id: string, userId: string, input: UpdateBillInput) {
    const existing = await this.getById(id, userId);
    return prisma.bill.update({
      where: { id },
      data: input,
      include: { account: true, category: true },
    });
  }

  async updateAmount(id: string, userId: string, amount: string) {
    await this.getById(id, userId);
    return prisma.bill.update({
      where: { id },
      data: { amount },
    });
  }

  async delete(id: string, userId: string) {
    await this.getById(id, userId);
    await prisma.bill.delete({ where: { id } });
  }

  async getCurrentMonthBills(userId: string) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const bills = await prisma.bill.findMany({
      where: { userId, isActive: true },
      include: {
        account: true,
        category: true,
        transactions: {
          where: {
            date: { gte: startOfMonth, lte: endOfMonth },
          },
          orderBy: { date: 'desc' },
          take: 1,
        },
      },
      orderBy: { dueDate: 'asc' },
    });

    const billsWithStatus = bills.map((bill) => {
      const lastTransaction = bill.transactions[0];
      const today = now.getDate();
      const dueDate = bill.dueDate;
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const lastPaidThisMonth = bill.lastPaidAt && bill.lastPaidAt >= startOfMonth && bill.lastPaidAt <= endOfMonth;

      let status: 'PAID' | 'PENDING' | 'OVERDUE';
      if (lastTransaction || lastPaidThisMonth) {
        status = 'PAID';
      } else if (dueDate >= today) {
        status = 'PENDING';
      } else {
        status = 'OVERDUE';
      }

      return {
        ...bill,
        status,
        lastTransaction,
      };
    });

    const summary = {
      paid: {
        count: billsWithStatus.filter((b) => b.status === 'PAID').length,
        total: billsWithStatus
          .filter((b) => b.status === 'PAID')
          .reduce((sum, b) => sum + Number(b.amount), 0)
          .toString(),
      },
      pending: {
        count: billsWithStatus.filter((b) => b.status === 'PENDING').length,
        total: billsWithStatus
          .filter((b) => b.status === 'PENDING')
          .reduce((sum, b) => sum + Number(b.amount), 0)
          .toString(),
      },
      overdue: {
        count: billsWithStatus.filter((b) => b.status === 'OVERDUE').length,
        total: billsWithStatus
          .filter((b) => b.status === 'OVERDUE')
          .reduce((sum, b) => sum + Number(b.amount), 0)
          .toString(),
      },
    };

    return { summary };
  }

  async getSummary(userId: string) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const bills = await prisma.bill.findMany({
      where: { userId, isActive: true },
      include: {
        transactions: {
          where: { date: { gte: startOfMonth, lte: endOfMonth } },
          take: 1,
        },
      },
    });

    const billsWithStatus = bills.map((bill) => {
      const lastTransaction = bill.transactions[0];
      const dueDateOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), bill.dueDate);

      let status: 'PAID' | 'PENDING' | 'OVERDUE';
      if (lastTransaction) {
        status = 'PAID';
      } else if (now >= dueDateOfCurrentMonth) {
        status = 'OVERDUE';
      } else {
        status = 'PENDING';
      }

      return { ...bill, status };
    });

    return {
      paid: {
        count: billsWithStatus.filter((b) => b.status === 'PAID').length,
        total: billsWithStatus
          .filter((b) => b.status === 'PAID')
          .reduce((sum, b) => sum + Number(b.amount), 0)
          .toString(),
      },
      pending: {
        count: billsWithStatus.filter((b) => b.status === 'PENDING').length,
        total: billsWithStatus
          .filter((b) => b.status === 'PENDING')
          .reduce((sum, b) => sum + Number(b.amount), 0)
          .toString(),
      },
      overdue: {
        count: billsWithStatus.filter((b) => b.status === 'OVERDUE').length,
        total: billsWithStatus
          .filter((b) => b.status === 'OVERDUE')
          .reduce((sum, b) => sum + Number(b.amount), 0)
          .toString(),
      },
    };
  }

  async markAsPaid(id: string, userId: string, amount?: string, createTransaction = true) {
    const bill = await this.getById(id, userId);
    const transactionAmount = amount || bill.amount;

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const existingTransaction = await prisma.transaction.findFirst({
      where: {
        billId: id,
        date: { gte: startOfMonth, lte: endOfMonth },
      },
    });

    if (existingTransaction) {
      throw new Error('Tagihan sudah memiliki transaksi di bulan ini');
    }

    if (!createTransaction) {
      await prisma.bill.update({
        where: { id },
        data: { lastExecutedAt: new Date(), lastPaidAt: new Date() },
      });
      return { success: true, billId: id, transactionCreated: false };
    }

    const account = await prisma.account.findFirst({
      where: { id: bill.accountId, userId },
    });
    if (!account) throw new Error('Akun tidak ditemukan');

    if (Number(account.balance) < Number(transactionAmount)) {
      throw new Error('Saldo tidak mencukupi');
    }

    const newBalance = (Number(account.balance) - Number(transactionAmount)).toString();

    const [transaction] = await prisma.$transaction([
      prisma.transaction.create({
        data: {
          userId,
          accountId: bill.accountId,
          categoryId: bill.categoryId,
          type: 'EXPENSE',
          amount: transactionAmount,
          description: `Tagihan: ${bill.name}`,
          date: new Date(),
          billId: bill.id,
        },
      }),
      prisma.account.update({
        where: { id: bill.accountId },
        data: { balance: newBalance },
      }),
    ]);

    return { success: true, billId: id, transaction, transactionCreated: true };
  }

  async getBillsForExecution(date: number) {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    return prisma.bill.findMany({
      where: {
        mode: 'AUTO_DEDUCT',
        isActive: true,
        executionDate: date,
        OR: [
          { lastExecutedAt: null },
          { lastExecutedAt: { lt: startOfMonth } },
        ],
      },
      include: { account: true, user: true },
    });
  }
}

export const billService = new BillService();
