import { prisma } from '../../config/prisma.js';
import { subMonths } from 'date-fns';

export interface ContextOptions {
  months?: number;
}

interface MonthlyBreakdown {
  month: string;
  income: number;
  expenses: number;
  savings: number;
}

interface TopExpense {
  category: string;
  amount: number;
  percentOfTotal: number;
}

interface BudgetProgress {
  name: string;
  budgeted: number;
  spent: number;
  percentUsed: number;
}

interface GoalProgress {
  name: string;
  current: number;
  target: number;
  percent: number;
}

interface BillCategoryBreakdown {
  category: string;
  total: number;
  count: number;
}

interface UpcomingBill {
  name: string;
  amount: number;
  dueDate: number;
}

interface BillSummary {
  totalMonthly: number;
  byCategory: BillCategoryBreakdown[];
  upcomingDue: UpcomingBill[];
  activeCount: number;
}

export interface FinancialContext {
  period: string;
  summary: {
    totalIncome: number;
    totalExpenses: number;
    totalSavings: number;
    avgMonthlyIncome: number;
    avgMonthlyExpenses: number;
    avgMonthlySavings: number;
  };
  totalBalance: number;
  monthlyBreakdown: MonthlyBreakdown[];
  topExpenses: TopExpense[];
  budgetProgress: BudgetProgress[];
  goalsProgress: GoalProgress[];
  bills: BillSummary;
}

async function getBills(userId: string): Promise<BillSummary> {
  const bills = await prisma.bill.findMany({
    where: { userId, isActive: true },
    include: { category: true },
  });

  if (bills.length === 0) {
    return {
      totalMonthly: 0,
      byCategory: [],
      upcomingDue: [],
      activeCount: 0,
    };
  }

  const byCategory = new Map<string, { total: number; count: number }>();
  let totalMonthly = 0;

  for (const bill of bills) {
    const amount = parseFloat(bill.amount);
    totalMonthly += amount;
    const catName = bill.category.name;
    const existing = byCategory.get(catName) || { total: 0, count: 0 };
    byCategory.set(catName, {
      total: existing.total + amount,
      count: existing.count + 1,
    });
  }

  const sortedByDue = [...bills].sort((a, b) => a.dueDate - b.dueDate);

  return {
    totalMonthly: Math.round(totalMonthly),
    byCategory: Array.from(byCategory.entries()).map(([category, data]) => ({
      category,
      total: Math.round(data.total),
      count: data.count,
    })),
    upcomingDue: sortedByDue.slice(0, 5).map(b => ({
      name: b.name,
      amount: parseFloat(b.amount),
      dueDate: b.dueDate,
    })),
    activeCount: bills.length,
  };
}

export async function buildFinancialContext(
  userId: string,
  options: ContextOptions = {}
): Promise<FinancialContext> {
  const months = options.months ?? 6;
  const startDate = subMonths(new Date(), months);

  const [accounts, expenseTransactions, budgets, goals, bills] = await Promise.all([
    prisma.account.findMany({
      where: { userId, isArchived: false },
      select: { name: true, balance: true },
    }),

    prisma.transaction.findMany({
      where: { userId, date: { gte: startDate }, type: 'EXPENSE' },
      select: { categoryId: true, amount: true },
    }),

    prisma.budget.findMany({
      where: { userId, isActive: true },
      select: {
        amount: true,
        spent: true,
        category: { select: { name: true } },
      },
    }),

    prisma.goal.findMany({
      where: { userId, status: 'ACTIVE' },
      select: {
        name: true,
        targetAmount: true,
        currentAmount: true,
      },
    }),

    getBills(userId),
  ]);

  const monthlyTotals = await prisma.transaction.findMany({
    where: { userId, date: { gte: startDate } },
    select: { amount: true, type: true, date: true },
  });

  const totalBalance = accounts.reduce((sum, acc) => sum + parseFloat(acc.balance), 0);

  const monthlyMap = new Map<string, { income: number; expenses: number }>();
  for (let i = 0; i < months; i++) {
    const d = subMonths(new Date(), i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthlyMap.set(key, { income: 0, expenses: 0 });
  }

  let totalIncome = 0;
  let totalExpenses = 0;

  const categoryTotals = new Map<string, number>();

  const categoryMap = new Map<string, string>();
  const categories = await prisma.category.findMany({
    where: { userId },
    select: { id: true, name: true },
  });
  for (const cat of categories) {
    categoryMap.set(cat.id, cat.name);
  }

  for (const tx of monthlyTotals) {
    const amount = parseFloat(tx.amount);
    const txDate = new Date(tx.date);
    const key = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, '0')}`;
    const monthly = monthlyMap.get(key);

    if (!monthly) continue;

    if (tx.type === 'INCOME') {
      totalIncome += amount;
      monthly.income += amount;
    } else if (tx.type === 'EXPENSE') {
      totalExpenses += amount;
      monthly.expenses += amount;
    }
  }

  for (const tx of expenseTransactions) {
    const catName = categoryMap.get(tx.categoryId) || 'Unknown';
    const current = categoryTotals.get(catName) || 0;
    categoryTotals.set(catName, current + parseFloat(tx.amount));
  }

  const totalSavings = totalIncome - totalExpenses;

  const monthlyBreakdown: MonthlyBreakdown[] = Array.from(monthlyMap.entries())
    .map(([month, data]) => ({
      month,
      income: Math.round(data.income),
      expenses: Math.round(data.expenses),
      savings: Math.round(data.income - data.expenses),
    }))
    .sort((a, b) => a.month.localeCompare(b.month));

  const topExpenses: TopExpense[] = Array.from(categoryTotals.entries())
    .map(([category, amount]) => ({
      category,
      amount: Math.round(amount),
      percentOfTotal: totalExpenses > 0 ? Math.round((amount / totalExpenses) * 100) : 0,
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  const budgetProgress: BudgetProgress[] = budgets.map((b) => {
    const budgeted = parseFloat(b.amount);
    const spent = parseFloat(b.spent);
    return {
      name: b.category.name,
      budgeted: Math.round(budgeted),
      spent: Math.round(spent),
      percentUsed: budgeted > 0 ? Math.round((spent / budgeted) * 100) : 0,
    };
  });

  const goalsProgress: GoalProgress[] = goals.map((g) => {
    const current = parseFloat(g.currentAmount);
    const target = parseFloat(g.targetAmount);
    return {
      name: g.name,
      current: Math.round(current),
      target: Math.round(target),
      percent: target > 0 ? Math.round((current / target) * 100) : 0,
    };
  });

  return {
    period: `${months} months`,
    summary: {
      totalIncome: Math.round(totalIncome),
      totalExpenses: Math.round(totalExpenses),
      totalSavings: Math.round(totalSavings),
      avgMonthlyIncome: Math.round(totalIncome / months),
      avgMonthlyExpenses: Math.round(totalExpenses / months),
      avgMonthlySavings: Math.round(totalSavings / months),
    },
    totalBalance: Math.round(totalBalance),
    monthlyBreakdown,
    topExpenses,
    budgetProgress,
    goalsProgress,
    bills,
  };
}

export function buildSystemPrompt(context: FinancialContext): string {
  const {
    period,
    summary,
    totalBalance,
    monthlyBreakdown,
    topExpenses,
    budgetProgress,
    goalsProgress,
    bills,
  } = context;

  const savingsRate = summary.totalIncome > 0
    ? Math.round((summary.totalSavings / summary.totalIncome) * 100)
    : 0;

  return `Kamu adalah Financial Assistant yang membantu pengguna mengelola keuangan pribadi.

## Data Keuangan (${period})
- Total Saldo: *Rp ${totalBalance.toLocaleString('id-ID')}*
- Total Penghasilan: *Rp ${summary.totalIncome.toLocaleString('id-ID')}*
- Total Pengeluaran: *Rp ${summary.totalExpenses.toLocaleString('id-ID')}*
- Total Tabungan: *Rp ${summary.totalSavings.toLocaleString('id-ID')}* (${savingsRate}% dari penghasilan)
- Rata-rata Bulanan: Income *Rp ${summary.avgMonthlyIncome.toLocaleString('id-ID')}*, Expense *Rp ${summary.avgMonthlyExpenses.toLocaleString('id-ID')}*, Savings *Rp ${summary.avgMonthlySavings.toLocaleString('id-ID')}*

## Breakdown Bulanan
${monthlyBreakdown.map(m => `- ${m.month}: Income *Rp ${m.income.toLocaleString('id-ID')}*, Expense *Rp ${m.expenses.toLocaleString('id-ID')}*, Savings *Rp ${m.savings.toLocaleString('id-ID')}*`).join('\n')}

## Top Pengeluaran
${topExpenses.map(e => `- ${e.category}: *Rp ${e.amount.toLocaleString('id-ID')}* (${e.percentOfTotal}%)`).join('\n')}

## Budget Progress
${budgetProgress.length > 0 ? budgetProgress.map(b => `- ${b.name}: *Rp ${b.spent.toLocaleString('id-ID')}* / *Rp ${b.budgeted.toLocaleString('id-ID')}* (${b.percentUsed}%)`).join('\n') : '- Tidak ada budget aktif'}

## Goals Progress
${goalsProgress.length > 0 ? goalsProgress.map(g => `- ${g.name}: *Rp ${g.current.toLocaleString('id-ID')}* / *Rp ${g.target.toLocaleString('id-ID')}* (${g.percent}%)`).join('\n') : '- Tidak ada goal aktif'}

## Bills (Fixed Expenses)
- Total Bulanan: *Rp ${bills.totalMonthly.toLocaleString('id-ID')}*
- Per Kategori: ${bills.byCategory.map(c => `${c.category} *Rp ${c.total.toLocaleString('id-ID')}* (${c.count})`).join(', ') || 'Tidak ada'}
- ${bills.activeCount} bills aktif
- Due dates: ${bills.upcomingDue.map(b => `${b.name} tgl ${b.dueDate}`).join(', ') || 'Tidak ada'}

## Instruksi
- Selalu jawab dalam Bahasa Indonesia
- Gunakan emoji yang relevan untuk mempercantik tampilan
- Bold angka untuk data penting
- Berikan insight yang actionable berdasarkan data di atas
- Jika ada masalah (budget overrun, savings rendah, goal tertinggal), berikan rekomendasi spesifik`;
}
