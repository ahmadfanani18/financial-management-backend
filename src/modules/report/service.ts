import { prisma } from '../../config/prisma.js';
import type { ReportQuery, MonthlyReportInput, TrendsInput, MutationsQuery } from './schemas.js';
import Papa from 'papaparse';

export class ReportService {
  async getMonthlyReport(userId: string, year: number, month: number, accountId?: string) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    const where: any = {
      userId,
      date: { gte: startDate, lte: endDate },
    };

    if (accountId) {
      where.OR = [
        { accountId },
        { fromAccountId: accountId },
        { toAccountId: accountId },
      ];
    }

    const transactions = await prisma.transaction.findMany({
      where,
      include: { category: true, account: true },
    });

    const income = transactions.filter(t => t.type === 'INCOME');
    const expense = transactions.filter(t => t.type === 'EXPENSE');
    const transfer = transactions.filter(t => t.type === 'TRANSFER');

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
        totalTransfer: transfer.reduce((sum, t) => sum + Number(t.amount), 0),
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

  async getTrends(userId: string, months: number = 6, accountId?: string) {
    const trends = [];
    const now = new Date();

    for (let i = months - 1; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0);

      const where: any = {
        userId,
        date: { gte: date, lte: endDate },
      };

      if (accountId) {
        where.OR = [
          { accountId },
          { fromAccountId: accountId },
          { toAccountId: accountId },
        ];
      }

      const transactions = await prisma.transaction.findMany({
        where,
      });

      const income = transactions.filter(t => t.type === 'INCOME').reduce((sum, t) => sum + Number(t.amount), 0);
      const expense = transactions.filter(t => t.type === 'EXPENSE').reduce((sum, t) => sum + Number(t.amount), 0);
      const trans = transactions.filter(t => t.type === 'TRANSFER').reduce((sum, t) => sum + Number(t.amount), 0);

      trends.push({
        month: date.toLocaleDateString('id-ID', { month: 'short' }),
        year: date.getFullYear(),
        income: Math.round(income),
        expense: Math.round(expense),
        transfer: Math.round(trans),
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

  async getMutations(userId: string, params: MutationsQuery) {
    const account = await prisma.account.findFirst({
      where: { id: params.accountId, userId },
    });
    if (!account) throw new Error('Akun tidak ditemukan');

    const startDateDay = new Date(params.startDate);
    startDateDay.setHours(0, 0, 0, 0);
    const endDateDay = new Date(params.endDate);
    endDateDay.setHours(23, 59, 59, 999);

    const baseWhere = {
      OR: [
        { accountId: params.accountId },
        { fromAccountId: params.accountId },
        { toAccountId: params.accountId },
      ],
      userId,
    };

    const priorWhere = {
      ...baseWhere,
      date: { lt: startDateDay },
    };

    const rangeWhere = {
      ...baseWhere,
      date: { gte: startDateDay, lte: endDateDay },
    };

    const [priorTransactions, allRangeTransactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where: priorWhere,
        select: { type: true, amount: true, adminFee: true, fromAccountId: true, toAccountId: true },
      }),
      prisma.transaction.findMany({
        where: rangeWhere,
        orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
        select: {
          id: true,
          date: true,
          description: true,
          type: true,
          amount: true,
          adminFee: true,
          fromAccountId: true,
          toAccountId: true,
          updatedAt: true,
          category: { select: { name: true } },
          toAccount: { select: { name: true } },
        },
      }),
      prisma.transaction.count({ where: rangeWhere }),
    ]);

    let totalIncome = 0;
    let totalExpense = 0;
    let transferIn = 0;
    let transferOut = 0;

    for (const t of allRangeTransactions) {
      if (t.type === 'INCOME') {
        totalIncome += Number(t.amount);
      } else if (t.type === 'EXPENSE') {
        totalExpense += Number(t.amount) + Number(t.adminFee || 0);
      } else if (t.type === 'TRANSFER') {
        if (t.fromAccountId === params.accountId) {
          transferOut += Number(t.amount);
        } else if (t.toAccountId === params.accountId) {
          transferIn += Number(t.amount);
        }
      }
    }

    let transferFee = 0;
    for (const t of allRangeTransactions) {
      if (t.type === 'TRANSFER' && t.fromAccountId === params.accountId) {
        transferFee += Number(t.adminFee || 0);
      }
    }

    const totalExpenseWithFees = totalExpense + transferFee;
    const totalChange = totalIncome - totalExpenseWithFees + (transferIn - transferOut);
    const currentBalance = Number(account.balance);
    const endingBalance = currentBalance;
    const startingBalance = currentBalance - totalChange;

    const transactionBalances = new Map<string, number>();
    let runningBalance = startingBalance;
    for (const t of allRangeTransactions) {
      let change = 0;
      if (t.type === 'INCOME') {
        change = Number(t.amount);
      } else if (t.type === 'EXPENSE') {
        change = -(Number(t.amount) + Number(t.adminFee || 0));
      } else if (t.type === 'TRANSFER') {
        if (t.fromAccountId === params.accountId) {
          change = -(Number(t.amount) + Number(t.adminFee || 0));
        } else if (t.toAccountId === params.accountId) {
          change = Number(t.amount);
        }
      }
      runningBalance += change;
      transactionBalances.set(t.id, runningBalance);
    }

    const paginatedTransactions = allRangeTransactions
      .slice((params.page - 1) * params.limit, params.page * params.limit);

    const transactionsWithBalance = paginatedTransactions.map(t => ({
      id: t.id,
      date: t.date.toISOString(),
      description: t.description,
      type: t.type,
      amount: Number(t.amount),
      adminFee: t.adminFee ? Number(t.adminFee) : undefined,
      category: t.category ? { name: t.category.name } : null,
      toAccount: t.type === 'TRANSFER' && t.toAccountId !== params.accountId
        ? { name: t.toAccount?.name || '' }
        : null,
      runningBalance: transactionBalances.get(t.id) ?? startingBalance,
    }));

    return {
      account: { id: account.id, name: account.name, type: account.type, currentBalance: Number(account.balance) },
      startingBalance,
      endingBalance,
      totalIncome,
      totalExpense: totalExpenseWithFees,
      totalTransfer: transferIn - transferOut,
      transactions: transactionsWithBalance,
      pagination: {
        page: params.page,
        limit: params.limit,
        total,
        totalPages: Math.ceil(total / params.limit),
      },
    };
  }

  async getMutationsForExport(userId: string, params: MutationsQuery) {
    const account = await prisma.account.findFirst({
      where: { id: params.accountId, userId },
    });
    if (!account) throw new Error('Akun tidak ditemukan');

    const startDateDay = new Date(params.startDate);
    startDateDay.setHours(0, 0, 0, 0);
    const endDateDay = new Date(params.endDate);
    endDateDay.setHours(23, 59, 59, 999);

    const baseWhere = {
      OR: [
        { accountId: params.accountId },
        { fromAccountId: params.accountId },
        { toAccountId: params.accountId },
      ],
      userId,
    };

    const priorWhere = {
      ...baseWhere,
      date: { lt: startDateDay },
    };

    const rangeWhere = {
      ...baseWhere,
      date: { gte: startDateDay, lte: endDateDay },
    };

    const [priorTransactions, allRangeTransactions] = await Promise.all([
      prisma.transaction.findMany({
        where: priorWhere,
        select: { type: true, amount: true, adminFee: true, fromAccountId: true, toAccountId: true },
      }),
      prisma.transaction.findMany({
        where: rangeWhere,
        orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
        select: {
          id: true,
          date: true,
          description: true,
          type: true,
          amount: true,
          adminFee: true,
          fromAccountId: true,
          toAccountId: true,
          category: { select: { name: true } },
          toAccount: { select: { name: true } },
        },
      }),
    ]);

    let totalIncome = 0;
    let totalExpense = 0;
    let transferIn = 0;
    let transferOut = 0;

    for (const t of allRangeTransactions) {
      if (t.type === 'INCOME') {
        totalIncome += Number(t.amount);
      } else if (t.type === 'EXPENSE') {
        totalExpense += Number(t.amount) + Number(t.adminFee || 0);
      } else if (t.type === 'TRANSFER') {
        if (t.fromAccountId === params.accountId) {
          transferOut += Number(t.amount);
        } else if (t.toAccountId === params.accountId) {
          transferIn += Number(t.amount);
        }
      }
    }

    let transferFee = 0;
    for (const t of allRangeTransactions) {
      if (t.type === 'TRANSFER' && t.fromAccountId === params.accountId) {
        transferFee += Number(t.adminFee || 0);
      }
    }

    const totalTransfer = transferIn - transferOut;
    const totalExpenseWithFees = totalExpense + transferFee;
    const currentBalance = Number(account.balance);
    const endingBalance = currentBalance;
    const startingBalance = currentBalance - (totalIncome - totalExpenseWithFees + totalTransfer);

    let runningBalance = startingBalance;
    const transactionsWithBalance = allRangeTransactions.map(t => {
      let change = 0;
      if (t.type === 'INCOME') {
        change = Number(t.amount);
      } else if (t.type === 'EXPENSE') {
        change = -(Number(t.amount) + Number(t.adminFee || 0));
      } else if (t.type === 'TRANSFER') {
        if (t.fromAccountId === params.accountId) {
          change = -(Number(t.amount) + Number(t.adminFee || 0));
        } else if (t.toAccountId === params.accountId) {
          change = Number(t.amount);
        }
      }
      runningBalance += change;

      return {
        id: t.id,
        date: t.date.toISOString(),
        description: t.description,
        type: t.type,
        amount: Number(t.amount),
        adminFee: t.adminFee ? Number(t.adminFee) : undefined,
        category: t.category ? { name: t.category.name } : null,
        toAccount: t.type === 'TRANSFER' && t.toAccountId !== params.accountId
          ? { name: t.toAccount?.name || '' }
          : null,
        runningBalance,
      };
    });

    return {
      account: { id: account.id, name: account.name, type: account.type, currentBalance },
      startingBalance,
      endingBalance,
      totalIncome,
      totalExpense: totalExpenseWithFees,
      totalTransfer,
      transactions: transactionsWithBalance,
    };
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

  async getInvestmentSummary(userId: string, accountId?: string) {
    const holdings = await prisma.holding.findMany({
      where: {
        account: { userId, type: 'INVESTMENT', isArchived: false },
        ...(accountId ? { accountId } : {}),
      },
      include: { account: { select: { id: true, name: true } } },
    });

    const num = (val: any) => Number(val?.toString() ?? 0);

    const totalValue = holdings.reduce((sum, h) => {
      const shares = num(h.quantity);
      const currentPrice = num(h.avgBuyPrice);
      return sum + (shares * currentPrice);
    }, 0);

    const totalInvested = holdings.reduce((sum, h) => {
      const shares = num(h.quantity);
      const avgPrice = num(h.avgBuyPrice);
      return sum + (shares * avgPrice);
    }, 0);

    const totalPnL = totalValue - totalInvested;
    const totalPnLPercent = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;

    return {
      totalValue: Math.round(totalValue),
      totalPnL: Math.round(totalPnL),
      totalPnLPercent: Math.round(totalPnLPercent * 100) / 100,
      holdingsCount: holdings.length,
      holdings: holdings.map(h => ({
        id: h.id,
        symbol: h.symbol,
        name: h.symbol,
        shares: num(h.quantity),
        avgPrice: num(h.avgBuyPrice),
        currentPrice: num(h.avgBuyPrice),
        value: Math.round(num(h.quantity) * num(h.avgBuyPrice)),
        pnl: 0,
        pnlPercent: 0,
      })),
    };
  }

  async getInvestmentPerformance(userId: string, months: number = 6, accountId?: string) {
    const performance = [];
    const now = new Date();

    for (let i = months - 1; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0);

      const holdings = await prisma.holding.findMany({
        where: {
          account: { userId, type: 'INVESTMENT' },
          ...(accountId ? { accountId } : {}),
          createdAt: { lte: endDate },
        },
      });

      const value = holdings.reduce((sum, h) => {
        const shares = Number(h.quantity?.toString() ?? 0);
        const price = Number(h.avgBuyPrice?.toString() ?? 0);
        return sum + (shares * price);
      }, 0);

      performance.push({
        month: date.toLocaleDateString('id-ID', { month: 'short' }),
        value: Math.round(value),
      });
    }

    return { performance };
  }

  async getInvestmentTransactions(userId: string, params: { accountId?: string; startDate?: Date; endDate?: Date; page: number; limit: number }) {
    const where: any = {
      account: { userId },
    };

    if (params.accountId) where.accountId = params.accountId;
    if (params.startDate || params.endDate) {
      where.transactionDate = {};
      if (params.startDate) where.transactionDate.gte = params.startDate;
      if (params.endDate) where.transactionDate.lte = params.endDate;
    }

    const [transactions, total] = await Promise.all([
      prisma.investmentTransaction.findMany({
        where,
        orderBy: { transactionDate: 'desc' },
        skip: (params.page - 1) * params.limit,
        take: params.limit,
      }),
      prisma.investmentTransaction.count({ where }),
    ]);

    return {
      transactions: transactions.map(t => ({
        id: t.id,
        date: t.transactionDate.toISOString(),
        type: t.type,
        symbol: t.symbol,
        quantity: t.quantity,
        pricePerShare: Number(t.pricePerShare),
        brokerFee: Number(t.brokerFee),
      })),
      pagination: {
        page: params.page,
        limit: params.limit,
        total,
        totalPages: Math.ceil(total / params.limit),
      },
    };
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
