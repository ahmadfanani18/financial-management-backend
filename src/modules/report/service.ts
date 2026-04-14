import { prisma } from '../../config/prisma.js';
import type { ReportQuery, MonthlyReportInput, TrendsInput } from './schemas.js';
import Papa from 'papaparse';

export class ReportService {
  async getMonthlyReport(userId: string, year: number, month: number) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const transactions = await prisma.transaction.findMany({
      where: {
        userId,
        date: { gte: startDate, lte: endDate },
      },
      include: { category: true, account: true },
    });

    const income = transactions.filter(t => t.type === 'INCOME');
    const expense = transactions.filter(t => t.type === 'EXPENSE');

    const incomeByCategory = this.groupByCategory(income);
    const expenseByCategory = this.groupByCategory(expense);

    return {
      period: {
        year,
        month,
        label: startDate.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }),
      },
      summary: {
        totalIncome: income.reduce((sum, t) => sum + Number(t.amount), 0),
        totalExpense: expense.reduce((sum, t) => sum + Number(t.amount), 0),
        balance: income.reduce((sum, t) => sum + Number(t.amount), 0) - expense.reduce((sum, t) => sum + Number(t.amount), 0),
      },
      incomeByCategory,
      expenseByCategory,
      transactions: transactions.slice(0, 50),
    };
  }

  async getCategoryBreakdown(userId: string, startDate: Date, endDate: Date) {
    const transactions = await prisma.transaction.findMany({
      where: {
        userId,
        type: 'EXPENSE',
        date: { gte: startDate, lte: endDate },
      },
      include: { category: true },
    });

    const breakdown: Record<string, { name: string; amount: number; color: string; percentage: number }> = {};
    const total = transactions.reduce((sum, t) => sum + Number(t.amount), 0);

    transactions.forEach(t => {
      const catName = t.category?.name || 'Other';
      if (!breakdown[catName]) {
        breakdown[catName] = {
          name: catName,
          amount: 0,
          color: t.category?.color || '#6B7280',
          percentage: 0,
        };
      }
      breakdown[catName].amount += Number(t.amount);
    });

    Object.values(breakdown).forEach(cat => {
      cat.percentage = total > 0 ? Math.round((cat.amount / total) * 100) : 0;
    });

    return {
      total,
      categories: Object.values(breakdown).sort((a, b) => b.amount - a.amount),
    };
  }

  async getTrends(userId: string, months: number = 6) {
    const trends = [];
    const now = new Date();

    for (let i = months - 1; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0);

      const transactions = await prisma.transaction.findMany({
        where: {
          userId,
          date: { gte: date, lte: endDate },
        },
      });

      const income = transactions.filter(t => t.type === 'INCOME').reduce((sum, t) => sum + Number(t.amount), 0);
      const expense = transactions.filter(t => t.type === 'EXPENSE').reduce((sum, t) => sum + Number(t.amount), 0);

      trends.push({
        month: date.toLocaleDateString('id-ID', { month: 'short' }),
        year: date.getFullYear(),
        income: Math.round(income),
        expense: Math.round(expense),
        balance: Math.round(income - expense),
      });
    }

    return { trends };
  }

  async getCashFlow(userId: string, startDate: Date, endDate: Date) {
    const transactions = await prisma.transaction.findMany({
      where: {
        userId,
        date: { gte: startDate, lte: endDate },
      },
      include: { account: true },
    });

    const dailyFlow: Record<string, { income: number; expense: number }> = {};

    transactions.forEach(t => {
      const dateKey = new Date(t.date).toISOString().split('T')[0];
      if (!dailyFlow[dateKey]) {
        dailyFlow[dateKey] = { income: 0, expense: 0 };
      }
      if (t.type === 'INCOME') {
        dailyFlow[dateKey].income += Number(t.amount);
      } else if (t.type === 'EXPENSE') {
        dailyFlow[dateKey].expense += Number(t.amount);
      }
    });

    const sortedDays = Object.entries(dailyFlow)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, data]) => ({
        date,
        income: Math.round(data.income),
        expense: Math.round(data.expense),
        balance: Math.round(data.income - data.expense),
      }));

    return { dailyFlow: sortedDays };
  }

  async getNetWorth(userId: string) {
    const accounts = await prisma.account.findMany({
      where: { userId, isArchived: false },
    });

    const totalAssets = accounts
      .filter(a => ['BANK', 'EWALLET', 'CASH'].includes(a.type))
      .reduce((sum, a) => sum + Number(a.balance), 0);

    const totalLiabilities = accounts
      .filter(a => a.type === 'CREDIT_CARD')
      .reduce((sum, a) => sum + Number(a.balance), 0);

    const investments = accounts
      .filter(a => a.type === 'INVESTMENT')
      .reduce((sum, a) => sum + Number(a.balance), 0);

    return {
      totalAssets: Math.round(totalAssets),
      totalLiabilities: Math.round(totalLiabilities),
      investments: Math.round(investments),
      netWorth: Math.round(totalAssets - totalLiabilities),
    };
  }

  private groupByCategory(transactions: any[]) {
    const grouped: Record<string, { name: string; amount: number; color: string }> = {};
    
    transactions.forEach(t => {
      const catName = t.category?.name || 'Other';
      if (!grouped[catName]) {
        grouped[catName] = { name: catName, amount: 0, color: t.category?.color || '#6B7280' };
      }
      grouped[catName].amount += Number(t.amount);
    });

    return Object.values(grouped).sort((a, b) => b.amount - a.amount);
  }

  async exportTransactions(userId: string, year: number, month: number): Promise<string> {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const transactions = await prisma.transaction.findMany({
      where: {
        userId,
        date: { gte: startDate, lte: endDate },
      },
      include: {
        account: { select: { name: true } },
        category: { select: { name: true } },
      },
      orderBy: { date: 'desc' },
    });

    const data = transactions.map((t) => ({
      Tanggal: t.date.toISOString().split('T')[0],
      Deskripsi: t.description,
      Kategori: t.category?.name || 'Tanpa Kategori',
      Akun: t.account?.name || 'Tanpa Akun',
      Tipe: t.type === 'INCOME' ? 'Pemasukan' : t.type === 'EXPENSE' ? 'Pengeluaran' : 'Transfer',
      Jumlah: t.amount,
    }));

    return Papa.unparse(data, {
      header: true,
      delimiter: ';',
    });
  }
}

export const reportService = new ReportService();
