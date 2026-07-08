import { prisma } from '../../config/prisma.js';
import type { GeneratePlanInput, PredictSpendingInput } from './schemas.js';

interface BudgetAllocation {
  category: string;
  percentage: number;
  amount: number;
  type: 'EXPENSE' | 'SAVING';
}

interface SpendingPrediction {
  category: string;
  expenseType: 'recurring' | 'occasional';
  predictedAmount: number;
  currentAverage: number;
  budgetLimit?: number;
  isOverBudget?: boolean;
  trend: 'increasing' | 'decreasing' | 'stable' | null;
  confidence: 'high' | 'medium' | 'low';
  dataPoints: number;
  calculationMethod: 'single_transaction' | 'weighted_average' | 'trend_projection' | 'no_spending';
  noSpendingRecorded?: boolean;
  trendChange?: number;
  monthsWithTransactions: number;
}

interface PredictSpendingResponse {
  predictions: SpendingPrediction[];
  totalPredicted: number;
  occasionalTotal?: number;
  totalBudget: number;
  totalSpent: number;
  totalBillsMonthly: number;
  period: string;
  message: string;
  insufficientData: boolean;
  insufficientDataMonths?: boolean;
}

interface SavingSuggestion {
  category: string;
  currentSpending: number;
  suggestedSaving: number;
  reason: string;
}

function weightedAverage(amounts: number[]): number {
  const n = amounts.length;
  if (n === 0) return 0;
  
  const weights = amounts.map((_, i) => (i + 1) / n * 2);
  const totalAmount = amounts.reduce((sum, amt, i) => sum + amt * weights[i], 0);
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  return totalAmount / totalWeight;
}

function calculateTimeSpanMonths(transactions: { date: Date }[]): number {
  if (transactions.length < 2) return 1;
  
  const dates = transactions.map(t => new Date(t.date));
  const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
  const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
  
  const monthsDiff = (maxDate.getFullYear() - minDate.getFullYear()) * 12 
                   + (maxDate.getMonth() - minDate.getMonth());
  
  return Math.max(1, monthsDiff + 1);
}

function calculateConfidenceScore(transactionCount: number, timeSpanMonths: number, lookbackMonths: number): 'high' | 'medium' | 'low' {
  const score = transactionCount * timeSpanMonths / lookbackMonths;
  if (score > 15) return 'high';
  if (score >= 5) return 'medium';
  return 'low';
}

function getUniqueMonths(transactions: { date: Date }[]): number {
  const uniqueMonths = new Set<string>();
  transactions.forEach(t => {
    const d = new Date(t.date);
    const month = String(d.getMonth() + 1).padStart(2, '0');
    uniqueMonths.add(`${d.getFullYear()}-${month}`);
  });
  return uniqueMonths.size;
}

function classifyExpenseFrequency(
  transactions: { date: Date }[],
  lookbackMonths: number
): 'recurring' | 'occasional' {
  if (transactions.length === 0) {
    return 'occasional';
  }

  const monthsWithTransactions = getUniqueMonths(transactions);

  if (monthsWithTransactions < 3) {
    return 'recurring';
  }

  const actualTimeSpan = Math.max(monthsWithTransactions, lookbackMonths);
  const frequencyRatio = monthsWithTransactions / actualTimeSpan;

  return frequencyRatio >= 0.5 ? 'recurring' : 'occasional';
}

function categorizeByDataPoints(
  amounts: number[],
  transactions: { date: Date; amount: number }[]
): {
  dataPoints: number;
  calculationMethod: 'single_transaction' | 'weighted_average' | 'trend_projection' | 'no_spending';
  predictedAmount: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  trendChange?: number;
} {
  const dataPoints = amounts.length;
  
  if (dataPoints === 0) {
    return {
      dataPoints,
      calculationMethod: 'no_spending',
      predictedAmount: 0,
      trend: 'stable',
    };
  }
  
  if (dataPoints === 1) {
    return {
      dataPoints,
      calculationMethod: 'single_transaction',
      predictedAmount: Math.round(amounts[0]),
      trend: 'stable',
    };
  }
  
  if (dataPoints < 4) {
    const weightedAvg = weightedAverage(amounts);
    return {
      dataPoints,
      calculationMethod: 'weighted_average',
      predictedAmount: Math.round(weightedAvg),
      trend: 'stable',
    };
  }
  
  const sortedByDate = [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const amountsSorted = sortedByDate.map(t => Number(t.amount));
  
  const lastMonth = amountsSorted.slice(0, Math.min(amountsSorted.length, 4));
  const lastAvg = weightedAverage(lastMonth);
  const prevMonth = amountsSorted.slice(Math.min(amountsSorted.length, 4), Math.min(amountsSorted.length, 8));
  const hasPrevData = prevMonth.length >= 2;
  const prevAvg = hasPrevData ? weightedAverage(prevMonth) : lastAvg;
  
  const change = (lastAvg - prevAvg) / (prevAvg || 1);
  const trend = change > 0.15 ? 'increasing' : change < -0.15 ? 'decreasing' : 'stable';
  const predictedAmount = Math.round(lastAvg * (1 + change * 0.3));
  
  return {
    dataPoints,
    calculationMethod: 'trend_projection',
    predictedAmount: Math.max(0, predictedAmount),
    trend,
    trendChange: Math.round(change * 100) / 100,
  };
}

export class AIService {
  async generatePlan(userId: string, input: GeneratePlanInput) {
    const { monthlyIncome, currency, dependents } = input;
    
    const needs = Math.round(monthlyIncome * 0.50);
    const wants = Math.round(monthlyIncome * 0.30);
    const savings = Math.round(monthlyIncome * 0.20);

    const expenseAllocations: BudgetAllocation[] = [
      { category: 'Food & Dining', percentage: 15, amount: Math.round(needs * 0.30), type: 'EXPENSE' },
      { category: 'Transportation', percentage: 10, amount: Math.round(needs * 0.20), type: 'EXPENSE' },
      { category: 'Bills & Utilities', percentage: 15, amount: Math.round(needs * 0.30), type: 'EXPENSE' },
      { category: 'Housing', percentage: 30, amount: Math.round(needs * 0.60), type: 'EXPENSE' },
      { category: 'Healthcare', percentage: 5, amount: Math.round(needs * 0.10), type: 'EXPENSE' },
      { category: 'Entertainment', percentage: 10, amount: Math.round(wants * 0.33), type: 'EXPENSE' },
      { category: 'Shopping', percentage: 10, amount: Math.round(wants * 0.33), type: 'EXPENSE' },
      { category: 'Other Wants', percentage: 10, amount: Math.round(wants * 0.34), type: 'EXPENSE' },
    ];

    const savingsAllocation: BudgetAllocation[] = [
      { category: 'Emergency Fund', percentage: 10, amount: Math.round(savings * 0.50), type: 'SAVING' },
      { category: 'Investment', percentage: 5, amount: Math.round(savings * 0.25), type: 'SAVING' },
      { category: 'Goals', percentage: 5, amount: Math.round(savings * 0.25), type: 'SAVING' },
    ];

    const suggestedGoal = {
      name: 'Dana Darurat',
      targetAmount: needs * 6,
      deadline: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    };

    const estimatedExpense = needs + wants * 0.5;
    const milestones = this.generateDynamicMilestones(monthlyIncome, estimatedExpense, dependents);

    return {
      summary: { monthlyIncome, needs, wants, savings, currency },
      expenses: expenseAllocations,
      savings: savingsAllocation,
      milestones,
      suggestedGoal,
      message: `Berdasarkan aturan 50/30/20, Anda bisa mengalokasikan ${needs.toLocaleString('id-ID')} untuk kebutuhan (50%), ${wants.toLocaleString('id-ID')} untuk keinginan (30%), dan ${savings.toLocaleString('id-ID')} untuk tabungan (20%).`,
    };
  }

private generateDynamicMilestones(monthlyIncome: number, estimatedExpense: number, dependents: number) {
      const milestones = [];
      const now = Date.now();
      const oneYear = 365 * 24 * 60 * 60 * 1000;
      const targetCount = 3 + Math.floor(Math.random() * 3); // Random 3-5 milestones

      // Always include Emergency Fund
      const emergencyFundTarget = estimatedExpense * 6;
      milestones.push({
        id: `temp-${milestones.length}`,
        title: 'Dana Darurat',
        description: `Tujuan: ${emergencyFundTarget.toLocaleString('id-ID')} (~${Math.round((emergencyFundTarget / monthlyIncome) * 100)}% dari pendapatan 6 bulan)`,
        targetDate: new Date(now + oneYear).toISOString(),
        targetAmount: emergencyFundTarget,
        isSelected: false,
      });

      // Pool of potential milestones with conditions
      const potentialMilestones: Array<{ title: string; desc: string; amount: number; months: number; condition?: boolean }> = [
        {
          title: 'Mulai Investasi',
          desc: `Investasi ${Math.round(monthlyIncome * 0.1).toLocaleString('id-ID')}/bulan`,
          amount: monthlyIncome * 0.1 * 12,
          months: 6,
          condition: monthlyIncome >= 10000000,
        },
        {
          title: 'Tabungan Pendidikan Anak',
          desc: `Tabungan ${Math.round(monthlyIncome * 0.15).toLocaleString('id-ID')}/bulan untuk ${dependents} anak`,
          amount: monthlyIncome * 0.15 * 12 * 5,
          months: 60,
          condition: dependents > 0,
        },
        {
          title: 'Kurangi Pengeluaran Hiburan',
          desc: `Hemat ${Math.round(monthlyIncome * 0.03).toLocaleString('id-ID')}/bulan dari hiburan`,
          amount: monthlyIncome * 0.03 * 6,
          months: 6,
        },
        {
          title: 'Tabungan Liburan',
          desc: `Tabungan vacation tahun depan`,
          amount: monthlyIncome * 0.08 * 8,
          months: 8,
          condition: monthlyIncome >= 8000000,
        },
        {
          title: 'Tabungan Gadget Baru',
          desc: `Upgrade smartphone/laptop`,
          amount: monthlyIncome * 0.15 * 4,
          months: 4,
          condition: monthlyIncome >= 5000000,
        },
        {
          title: 'Tabungan Rumah',
          desc: `Uang muka rumah`,
          amount: monthlyIncome * 0.25 * 20,
          months: 20,
          condition: monthlyIncome >= 15000000,
        },
        {
          title: 'Tabungan Mobil',
          desc: `Uang muka kendaraan`,
          amount: monthlyIncome * 0.2 * 15,
          months: 15,
          condition: monthlyIncome >= 10000000,
        },
        {
          title: 'Tabungan Pensiun Dini',
          desc: `Siap pensiun lebih awal`,
          amount: monthlyIncome * 0.15 * 12 * 3,
          months: 36,
          condition: monthlyIncome >= 8000000,
        },
        {
          title: 'Tabungan Kesehatan',
          desc: `Dana darurat medis`,
          amount: estimatedExpense * 4,
          months: 4,
        },
        {
          title: 'Tabungan Bisnis',
          desc: `Modal usaha sampingan`,
          amount: monthlyIncome * 0.2 * 6,
          months: 6,
          condition: monthlyIncome >= 10000000,
        },
        {
          title: 'Tabungan Pengembangan Diri',
          desc: `Kursus/sertifikasi`,
          amount: monthlyIncome * 0.1 * 6,
          months: 6,
          condition: monthlyIncome >= 5000000,
        },
        {
          title: 'Tabungan Tahunan',
          desc: `Tabungan untuk kebutuhan tahun depan`,
          amount: monthlyIncome * 0.2 * 12,
          months: 12,
        },
        {
          title: 'Tabungan Asuransi',
          desc: `Premi asuransi tahunan`,
          amount: monthlyIncome * 0.05 * 12,
          months: 12,
          condition: monthlyIncome >= 6000000,
        },
        {
          title: 'Kurangi Langganan',
          desc: `Hemat subscription tidak perlu`,
          amount: monthlyIncome * 0.02 * 6,
          months: 6,
          condition: monthlyIncome >= 5000000,
        },
        {
          title: 'Tabungan Belanja',
          desc: `Hemat groceries bulanan`,
          amount: monthlyIncome * 0.03 * 4,
          months: 4,
        },
      ];

      // Filter by condition and shuffle
      const availableMilestones = potentialMilestones.filter(m => m.condition === undefined || m.condition);
      const shuffled = availableMilestones.sort(() => Math.random() - 0.5);
      const picked = shuffled.slice(0, targetCount);

      for (const m of picked) {
        const monthMs = 30 * 24 * 60 * 60 * 1000 * m.months;
        milestones.push({
          id: `temp-${milestones.length}`,
          title: m.title,
          description: m.desc,
          targetDate: new Date(now + monthMs).toISOString(),
          targetAmount: Math.round(m.amount),
          isSelected: false,
        });
      }

      return milestones;
    }

async predictSpending(userId: string, input: PredictSpendingInput): Promise<PredictSpendingResponse> {
    const { months } = input;
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    // Get transactions
    const transactions = await prisma.transaction.findMany({
      where: {
        userId,
        type: 'EXPENSE',
        date: { gte: startDate },
      },
      include: { category: true },
    });

    // Get budgets for comparison
    const budgets = await prisma.budget.findMany({
      where: {
        userId,
        isActive: true,
        startDate: { lte: new Date() },
        OR: [{ endDate: null }, { endDate: { gte: new Date() } }],
      },
      include: { category: true },
    });

    // Get accounts for total balance context
    const accounts = await prisma.account.findMany({
      where: { userId, isArchived: false },
      select: { balance: true },
    });
    const totalBalance = accounts.reduce((sum, acc) => sum + Number(acc.balance), 0);

    // Get bills for fixed recurring expenses context
    const bills = await prisma.bill.findMany({
      where: { userId, isActive: true },
    });
    const totalBillsMonthly = bills.reduce((sum, b) => sum + parseFloat(b.amount), 0);

    if (transactions.length === 0) {
      return {
        predictions: [],
        totalPredicted: 0,
        totalBudget: 0,
        totalSpent: 0,
        totalBillsMonthly,
        period: `Bulan ${new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}`,
        message: totalBillsMonthly > 0
          ? `Bills tetap Anda: ${totalBillsMonthly.toLocaleString('id-ID')}/bulan. Tapi data transaksi kurang dari 3 bulan.`
          : 'Data transaksi masih kurang dari 3 bulan. Tambahkan lebih banyak transaksi untuk mendapatkan prediksi yang akurat.',
        insufficientData: true,
      };
    }

    // Create budget map for comparison
    const budgetMap: Record<string, number> = {};
    budgets.forEach(b => {
      const catName = b.category?.name || 'Other';
      budgetMap[catName] = Number(b.amount);
    });

    const categoryMap: Record<string, number[]> = {};
    
    transactions.forEach(t => {
      const catName = t.category?.name || 'Other';
      if (!categoryMap[catName]) {
        categoryMap[catName] = [];
      }
      categoryMap[catName].push(Number(t.amount));
    });

    const predictions: SpendingPrediction[] = Object.entries(categoryMap).map(([category, amounts]) => {
      const catTransactions = transactions.filter(t => (t.category?.name || 'Other') === category);
      const timeSpanMonths = calculateTimeSpanMonths(catTransactions);
      const confidenceScore = calculateConfidenceScore(amounts.length, timeSpanMonths, months);
      const result = categorizeByDataPoints(amounts, catTransactions);
      const expenseType = classifyExpenseFrequency(catTransactions, months);
      const monthsWithTransactions = getUniqueMonths(catTransactions);

      const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length;
      const budgetLimit = budgetMap[category];
      const isOverBudget = budgetLimit && avg > budgetLimit;

      return {
        category,
        predictedAmount: expenseType === 'occasional' ? 0 : result.predictedAmount,
        currentAverage: Math.round(avg),
        budgetLimit: budgetLimit || undefined,
        isOverBudget,
        trend: expenseType === 'occasional' ? null : result.trend,
        confidence: confidenceScore,
        dataPoints: result.dataPoints,
        calculationMethod: result.calculationMethod,
        noSpendingRecorded: result.calculationMethod === 'no_spending',
        trendChange: result.trendChange,
        expenseType,
        monthsWithTransactions,
      };
    });

    const totalPredicted = predictions
      .filter(p => p.expenseType === 'recurring')
      .reduce((sum, p) => sum + p.predictedAmount, 0);

    const occasionalTotal = predictions
      .filter(p => p.expenseType === 'occasional')
      .reduce((sum, p) => sum + p.currentAverage, 0);

    const totalBudget = budgets.reduce((sum, b) => sum + Number(b.amount), 0);
    const totalSpent = transactions.reduce((sum, t) => sum + Number(t.amount), 0);
    const actualTimeSpan = calculateTimeSpanMonths(transactions);

    let message: string;
    let insufficientDataMonths = false;

    if (transactions.length === 0) {
      message = 'Data transaksi masih kurang dari 3 bulan. Tambahkan lebih banyak transaksi untuk mendapatkan prediksi yang akurat.';
    } else if (actualTimeSpan < 3) {
      message = `Data kamu masih ${actualTimeSpan} bulan. Prediksi akan lebih akurat setelah 3 bulan penggunaan.`;
      insufficientDataMonths = true;
    } else {
      message = `Prediksi bulan depan ${totalPredicted.toLocaleString('id-ID')} (hanya recurring). Expense jarang-jarang: ${(occasionalTotal || 0).toLocaleString('id-ID')}.`;
      if (totalBudget > 0) {
        const budgetUsagePercent = Math.round((totalSpent / totalBudget) * 100);
        message += ` Penggunaan budget bulan ini: ${budgetUsagePercent}%.`;
      }
      if (totalBalance > 0) {
        message += ` Total saldo akun: ${totalBalance.toLocaleString('id-ID')}.`;
      }
      if (totalBillsMonthly > 0) {
        message += ` Bills tetap: ${totalBillsMonthly.toLocaleString('id-ID')}/bulan.`;
      }
    }

    return {
      predictions: predictions.sort((a, b) => b.predictedAmount - a.predictedAmount),
      totalPredicted,
      occasionalTotal,
      totalBudget,
      totalSpent,
      totalBillsMonthly,
      period: `Bulan ${new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}`,
      message,
      insufficientData: transactions.length === 0,
      insufficientDataMonths,
};
  }

  async suggestSavings(userId: string) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // Get expense and income transactions (exclude TRANSFER, from non-locked accounts only)
    const transactions = await prisma.transaction.findMany({
      where: {
        userId,
        date: { gte: startOfMonth, lte: endOfMonth },
        type: { in: ['EXPENSE', 'INCOME'] },
        account: {
          isLocked: false,
          isArchived: false,
        },
      },
      include: { category: true },
    });

    // Get accounts for total balance (exclude locked accounts)
    const accounts = await prisma.account.findMany({
      where: { userId, isArchived: false, isLocked: false },
      select: { id: true, name: true, balance: true },
    });
    const totalBalance = accounts.reduce((sum, acc) => sum + Number(acc.balance), 0);

    // Get active goals with progress
    const goals = await prisma.goal.findMany({
      where: { userId, status: 'ACTIVE' },
      select: { id: true, name: true, currentAmount: true, targetAmount: true, deadline: true },
    });

    // Get budgets for this month
    const budgets = await prisma.budget.findMany({
      where: {
        userId,
        isActive: true,
        startDate: { lte: endOfMonth },
        OR: [{ endDate: null }, { endDate: { gte: startOfMonth } }],
      },
      include: { category: true },
    });

    // Get bills for fixed recurring expenses
    const bills = await prisma.bill.findMany({
      where: { userId, isActive: true },
    });
    const monthlyBills = bills.reduce((sum, b) => sum + parseFloat(b.amount), 0);

    // Calculate monthly totals
    const income = transactions.filter(t => t.type === 'INCOME').reduce((sum, t) => sum + Number(t.amount), 0);
    const expenses = transactions.filter(t => t.type === 'EXPENSE').reduce((sum, t) => sum + Number(t.amount), 0);
    const currentBalance = totalBalance - expenses;
    const availableFunds = Math.max(0, totalBalance - monthlyBills);

    const suggestions: SavingSuggestion[] = [];

    // Suggest based on positive available funds
    if (availableFunds > 0) {
      const remainingToEmergency = Math.max(0, (availableFunds * 0.5) - totalBalance);
      if (remainingToEmergency > 0 && remainingToEmergency < availableFunds * 0.5) {
        suggestions.push({
          category: 'Dana Darurat',
          currentSpending: 0,
          suggestedSaving: Math.min(Math.round(availableFunds * 0.25), remainingToEmergency),
          reason: `Tambahkan ke dana darurat. Sisa yang dibutuhkan: ${remainingToEmergency.toLocaleString('id-ID')}`,
        });
      } else {
        suggestions.push({
          category: 'Tabungan Umum',
          currentSpending: 0,
          suggestedSaving: Math.round(availableFunds * 0.25),
          reason: 'Anda memiliki saldo tersedia. Simpan 25% untuk masa depan.',
        });
      }
    }

    // Suggest based on goals progress
    goals.forEach(goal => {
      const progress = Number(goal.currentAmount) / Number(goal.targetAmount);
      const remaining = Number(goal.targetAmount) - Number(goal.currentAmount);
      const daysLeft = Math.ceil((new Date(goal.deadline).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      if (progress < 0.5 && daysLeft > 30 && income > 0) {
        const monthlyNeeded = remaining / Math.min(daysLeft / 30, 12);
        if (monthlyNeeded > income * 0.1) {
          suggestions.push({
            category: `Target: ${goal.name}`,
            currentSpending: Number(goal.currentAmount),
            suggestedSaving: Math.round(monthlyNeeded),
            reason: `Target ${goal.name} tercapai ${Math.round(progress * 100)}%. Perlu tabungan ${monthlyNeeded.toLocaleString('id-ID')}/bulan untuk mencapai target.`,
          });
        }
      }
    });

    // Suggest based on overspent categories
    const categorySpending: Record<string, number> = {};
    transactions.filter(t => t.type === 'EXPENSE').forEach(t => {
      const catName = t.category?.name || 'Other';
      categorySpending[catName] = (categorySpending[catName] || 0) + Number(t.amount);
    });

    // Check against budgets
    budgets.forEach(budget => {
      const catName = budget.category?.name || 'Other';
      const spent = categorySpending[catName] || 0;
      const limit = Number(budget.amount);
      
      if (spent > limit) {
        const overBy = spent - limit;
        suggestions.push({
          category: catName,
          currentSpending: spent,
          suggestedSaving: Math.round(overBy * 0.3),
          reason: `Pengeluaran ${catName} melebihi budget ${limit.toLocaleString('id-ID')} sebesar ${Math.round((overBy / limit) * 100)}%. Hemat 30% dari kelebihan untuk tabungan.`,
        });
      } else if (spent > limit * 0.8 && spent <= limit) {
        suggestions.push({
          category: catName,
          currentSpending: spent,
          suggestedSaving: Math.round((limit - spent) * 0.5),
          reason: `Pengeluaran ${catName} sudah ${Math.round((spent / limit) * 100)}% dari budget. Sisakan 50% untuk tabungan.`,
        });
      }
    });

    // General suggestions - spending from savings
    if (totalBalance > 0 && currentBalance < 0) {
      suggestions.push({
        category: 'Spending dari Tabungan',
        currentSpending: expenses,
        suggestedSaving: Math.round(Math.abs(currentBalance) * 0.1),
        reason: `Anda spending dari tabungan. Coba hemat 10% dari pengeluaran untuk menjaga saldo.`,
      });
    }

    // Account-based suggestion
    if (totalBalance > 10000000) {
      suggestions.push({
        category: 'Investasi',
        currentSpending: 0,
        suggestedSaving: Math.round(totalBalance * 0.1),
        reason: `Total saldo Anda (${totalBalance.toLocaleString('id-ID')}) sudah sehat. Pertimbangkan investasi 10% untuk pertumbuhan.`,
      });
    }

    return {
      suggestions: suggestions.slice(0, 5),
      currentBalance,
      totalAccountBalance: totalBalance,
      activeGoalsCount: goals.length,
      monthlyIncome: income,
      monthlyExpenses: expenses,
      monthlyBills,
      message: suggestions.length > 0
        ? `Ditemukan ${suggestions.length} saran berdasarkan analisis keuangan Anda bulan ini.`
        : 'Pertahankan kebiasaan keuangan Anda yang baik!',
    };
  }

  async generatePlanFromData(userId: string) {
    const accounts = await prisma.account.findMany({
      where: { userId, isArchived: false },
      select: { id: true, name: true, balance: true, type: true },
    });

    const totalBalance = accounts.reduce((sum, acc) => sum + Number(acc.balance), 0);

    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const transactions = await prisma.transaction.findMany({
      where: {
        userId,
        date: { gte: threeMonthsAgo },
      },
      include: { category: true },
    });

    const transactionDates = transactions.map(t => new Date(t.date).getTime());
    const minDate = transactionDates.length > 0 ? Math.min(...transactionDates) : Date.now();
    const maxDate = transactionDates.length > 0 ? Math.max(...transactionDates) : Date.now();
    const actualMonths = Math.max(1, Math.ceil((maxDate - minDate) / (30 * 24 * 60 * 60 * 1000)));

    const totalIncome = transactions
      .filter(t => t.type === 'INCOME')
      .reduce((sum, t) => sum + Number(t.amount), 0);
    const monthlyIncome = totalIncome / actualMonths;

    const totalExpense = transactions
      .filter(t => t.type === 'EXPENSE')
      .reduce((sum, t) => sum + Number(t.amount), 0);
    const monthlyExpenseToUse = totalExpense / actualMonths;

    if (transactions.length < 5 || totalIncome === 0) {
      return {
        error: true,
        message: 'Data transaksi tidak cukup. Tambahkan minimal 5 transaksi termasuk pendapatan untuk menghasilkan rencana.',
        plan: null,
        summary: null,
      };
    }

    const expenseByCategory: Record<string, number> = {};
    transactions
      .filter(t => t.type === 'EXPENSE')
      .forEach(t => {
        const catName = t.category?.name || 'Lainnya';
        expenseByCategory[catName] = (expenseByCategory[catName] || 0) + Number(t.amount);
      });

    const topExpenses = Object.entries(expenseByCategory)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const savings = monthlyIncome - monthlyExpenseToUse;
    const savingsDisplay = savings > 0 
      ? savings.toLocaleString('id-ID')
      : `Terjadi deficit ${Math.abs(savings).toLocaleString('id-ID')}`;

    const planName = `Rencana Keuangan ${new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}`;
    const startDate = new Date();
    const endDate = new Date();
    endDate.setFullYear(endDate.getFullYear() + 1);

    const milestones: Array<{title: string; description: string; targetDate: Date; targetAmount: number}> = [];

    const emergencyFundTarget = monthlyExpenseToUse * 6;
    const incomePercent = monthlyIncome > 0 ? Math.round((emergencyFundTarget / monthlyIncome) * 100) : 0;
    milestones.push({
      title: 'Dana Darurat',
      description: `Tujuan: ${emergencyFundTarget.toLocaleString('id-ID')} (~${incomePercent}% dari pendapatan 6 bulan)`,
      targetDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
      targetAmount: emergencyFundTarget,
    });

    if (topExpenses.length > 0) {
      const [topCategory, amount] = topExpenses[0];
      const reductionTarget = amount * 0.2;
      milestones.push({
        title: `Kurangi Pengeluaran ${topCategory}`,
        description: `Kurangi ${reductionTarget.toLocaleString('id-ID')}/bulan dari kategori ${topCategory}`,
        targetDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        targetAmount: reductionTarget * 3,
      });
    }

    if (savings > 0) {
      const savingsTarget = monthlyIncome * 0.2 * 12;
      if (savingsTarget > 0) {
        milestones.push({
          title: 'Tabungan Tahunan',
          description: `Tabungan ${Math.round(monthlyIncome * 0.2).toLocaleString('id-ID')}/bulan`,
          targetDate: endDate,
          targetAmount: savingsTarget,
        });
      }
    } else {
      milestones.push({
        title: 'Kurangi Defisit',
        description: `Kurangi pengeluaran ${Math.round(Math.abs(savings) * 0.3).toLocaleString('id-ID')}/bulan untuk mencapai keseimbangan`,
        targetDate: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000),
        targetAmount: Math.round(Math.abs(savings) * 0.3 * 4),
      });
    }

    if (totalBalance > monthlyExpenseToUse * 3 && savings > 0) {
      milestones.push({
        title: 'Mulai Investasi',
        description: 'Mulai investasi dengan 10% dari surplus',
        targetDate: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000),
        targetAmount: monthlyIncome * 0.1 * 6,
      });
    }

    return {
      error: false,
      plan: {
        name: planName,
        description: `Rencana keuangan berdasarkan analisis data ${actualMonths} bulan terakhir. Pendapatan rata-rata: ${Math.round(monthlyIncome).toLocaleString('id-ID')}/bulan, Pengeluaran: ${Math.round(monthlyExpenseToUse).toLocaleString('id-ID')}/bulan.`,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        status: 'ACTIVE' as const,
        milestones: milestones.map((m, idx) => ({
          ...m,
          targetDate: m.targetDate.toISOString(),
          id: `temp-${idx}`,
          isCompleted: false,
          order: idx,
        })),
      },
      summary: {
        totalBalance: totalBalance.toLocaleString('id-ID'),
        monthlyIncome: Math.round(monthlyIncome).toLocaleString('id-ID'),
        monthlyExpenseToUse: Math.round(monthlyExpenseToUse).toLocaleString('id-ID'),
        savings: savingsDisplay,
        topExpenses: topExpenses.slice(0, 3).map(([cat, amt]) => ({ category: cat, amount: amt })),
      },
    };
  }
}

export const aiService = new AIService();

export class SmartSaverService {
  async calculate(userId: string, input: { itemName?: string; targetPrice: number; monthlyBudget?: number }) {
    const { itemName, targetPrice, monthlyBudget } = input;
    
    const now = new Date();
    const threeMonthsAgo = new Date(now);
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    // 1. Get account balances (exclude locked accounts)
    const accounts = await prisma.account.findMany({
      where: { userId, isArchived: false, isLocked: false },
      select: { id: true, name: true, balance: true },
    });
    const totalBalance = accounts.reduce((sum, acc) => sum + Number(acc.balance), 0);
    
    // 2. Get monthly income - take only largest transaction per month
    const incomeTransactions = await prisma.transaction.findMany({
      where: { userId, date: { gte: threeMonthsAgo }, type: 'INCOME' },
    });
    
    // Group by month and take largest per month
    const incomeByMonth: Record<string, number[]> = {};
    incomeTransactions.forEach(t => {
      const monthKey = `${new Date(t.date).getFullYear()}-${String(new Date(t.date).getMonth() + 1).padStart(2, '0')}`;
      if (!incomeByMonth[monthKey]) incomeByMonth[monthKey] = [];
      incomeByMonth[monthKey].push(Number(t.amount));
    });
    
    const monthlyIncomeValues = Object.values(incomeByMonth).map(amounts => Math.max(...amounts));
    const monthlyIncome = monthlyIncomeValues.length > 0 
      ? monthlyIncomeValues.reduce((sum, val) => sum + val, 0) / monthlyIncomeValues.length 
      : 0;
    
    // 3. Get monthly expenses (actual)
    const expenseTransactions = await prisma.transaction.findMany({
      where: { userId, date: { gte: threeMonthsAgo }, type: 'EXPENSE' },
      include: { category: true },
    });
    const totalExpense = expenseTransactions.reduce((sum, t) => sum + Number(t.amount), 0);
    
    // 4. Get active budgets for this month
    const budgets = await prisma.budget.findMany({
      where: {
        userId,
        isActive: true,
        startDate: { lte: now },
        OR: [{ endDate: null }, { endDate: { gte: startOfMonth } }],
      },
      include: { category: true },
    });
    const totalBudgetAmount = budgets.reduce((sum, b) => sum + Number(b.amount), 0);
    
    // Get active bills for fixed commitments
    const bills = await prisma.bill.findMany({
      where: { userId, isActive: true },
    });
    const totalBills = bills.reduce((sum, b) => sum + parseFloat(b.amount), 0);
    
    // Calculate available for savings = Income - Budget Commitments - Bills
    const availableForSavings = monthlyIncome - totalBudgetAmount - totalBills;
    
    // Use higher of budget or actual expense, but sanity check
    // If budget is > 5x actual expense, it's probably not realistic
    const monthlyExpenseToUseActual = totalExpense / 3;
    const monthlyExpense = totalBudgetAmount > monthlyExpenseToUseActual * 5 
      ? monthlyExpenseToUseActual 
      : totalBudgetAmount;
    
    // 5. Get existing goals with required monthly contributions
    const activeGoals = await prisma.goal.findMany({
      where: { userId, status: 'ACTIVE' },
    });
    
    let existingGoalMonthlyContribution = 0;
    
    for (const goal of activeGoals) {
      const remaining = Number(goal.targetAmount) - Number(goal.currentAmount);
      if (remaining > 0) {
        const daysLeft = Math.max(1, Math.ceil((new Date(goal.deadline).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
        const monthsLeft = Math.max(1, daysLeft / 30);
        existingGoalMonthlyContribution += remaining / monthsLeft;
      }
    }
    
    // 6. Calculate remaining for new goal
    const remainingForNewGoal = Math.max(0, availableForSavings - existingGoalMonthlyContribution);
    
    // Generate insight
    let insight: string;
    if (existingGoalMonthlyContribution > 0) {
      insight = `Berdasarkan kondisi keuangan Anda (pendapatan Rp ${Math.round(monthlyIncome).toLocaleString('id-ID')}/bulan, budget komitmen Rp ${Math.round(totalBudgetAmount).toLocaleString('id-ID')}/bulan, bills tetap Rp ${Math.round(totalBills).toLocaleString('id-ID')}/bulan). `;
      insight += `Sisa yang tersedia untuk ditabung: Rp ${Math.round(remainingForNewGoal).toLocaleString('id-ID')}/bulan. `;
      insight += `Dengan goal aktif lain membutuhkan Rp ${Math.round(existingGoalMonthlyContribution).toLocaleString('id-ID')}/bulan.`;
    } else {
      insight = `Berdasarkan kondisi keuangan Anda (pendapatan Rp ${Math.round(monthlyIncome).toLocaleString('id-ID')}/bulan, budget komitmen Rp ${Math.round(totalBudgetAmount).toLocaleString('id-ID')}/bulan, bills tetap Rp ${Math.round(totalBills).toLocaleString('id-ID')}/bulan). `;
      insight += `Sisa yang tersedia untuk ditabung: Rp ${Math.round(availableForSavings).toLocaleString('id-ID')}/bulan.`;
    }
    
    // If remaining is 0 or negative, use availableForSavings as the base
    const baseForOptions = remainingForNewGoal > 0 ? remainingForNewGoal : availableForSavings;
    
    // Generate 3 options with exact division
    // Conservative = 12 months, Balanced = 6 months, Aggressive = 3 months
    const conservativeMonthly = Math.round(targetPrice / 12);
    const balancedMonthly = Math.round(targetPrice / 6);
    const aggressiveMonthly = Math.round(targetPrice / 3);
    
    // Determine feasibility based on affordability
    const isConservativeAffordable = conservativeMonthly <= baseForOptions * 0.5;
    const isBalancedAffordable = balancedMonthly <= baseForOptions * 0.5;
    const isAggressiveAffordable = aggressiveMonthly <= baseForOptions * 0.5;
    
    const options: Array<{ label: string; monthlyNeeded: number; estimatedMonths: number; feasibility: 'safe' | 'tight' | 'aggressive' }> = [
      {
        label: 'Conservative',
        monthlyNeeded: conservativeMonthly,
        estimatedMonths: 12,
        feasibility: isConservativeAffordable ? 'safe' : 'aggressive',
      },
      {
        label: 'Balanced',
        monthlyNeeded: balancedMonthly,
        estimatedMonths: 6,
        feasibility: isBalancedAffordable ? 'tight' : 'aggressive',
      },
      {
        label: 'Aggressive',
        monthlyNeeded: aggressiveMonthly,
        estimatedMonths: 3,
        feasibility: isAggressiveAffordable ? 'aggressive' : 'aggressive',
      },
    ];
    
    // Determine recommended based on affordability
    let recommended: 'conservative' | 'balanced' | 'aggressive';
    if (isConservativeAffordable) {
      recommended = 'conservative';
    } else if (isBalancedAffordable) {
      recommended = 'balanced';
    } else {
      recommended = 'aggressive';
    }
    
    return {
      options,
      recommended,
      progress: 0,
      remainingNeeded: targetPrice,
      startDate: now.toISOString(),
      insight,
      context: {
        monthlyIncome: Math.round(monthlyIncome),
        monthlyExpense: Math.round(monthlyExpense),
        totalBalance: Math.round(totalBalance),
        existingGoalsCount: activeGoals.length,
        existingGoalMonthlyContribution: Math.round(existingGoalMonthlyContribution),
      },
    };
  }
  
  async getSuggestions(userId: string) {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    const transactions = await prisma.transaction.findMany({
      where: { userId, date: { gte: sixMonthsAgo }, type: 'EXPENSE' },
      include: { category: true },
      orderBy: { date: 'desc' },
    });
    
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    
    const incomeTransactions = await prisma.transaction.findMany({
      where: { userId, date: { gte: threeMonthsAgo }, type: 'INCOME' },
    });
    
    const totalIncome = incomeTransactions.reduce((sum, t) => sum + Number(t.amount), 0);
    const monthlyIncome = totalIncome / 3;
    
    const patternGroups: Record<string, { amount: number; count: number; dates: string[]; merchant: string }> = {};
    
    const purchaseKeywords = ['tokopedia', 'shopee', 'lazada', 'blibli', 'toko', 'store', 'shop', 'market'];
    
    transactions.forEach(t => {
      const desc = (t.description || '').toLowerCase();
      const merchant = t.description || 'Unknown';
      
      const isPurchase = purchaseKeywords.some(k => desc.includes(k)) || t.category?.name !== 'Routine';
      
      if (isPurchase && Number(t.amount) > 50000) {
        if (!patternGroups[merchant]) {
          patternGroups[merchant] = { amount: 0, count: 0, dates: [], merchant };
        }
        patternGroups[merchant].amount += Number(t.amount);
        patternGroups[merchant].count += 1;
        patternGroups[merchant].dates.push(t.date.toISOString());
      }
    });
    
    const suggestions = Object.entries(patternGroups)
      .filter(([, data]) => data.count >= 1)
      .map(([name, data]) => {
        const avgAmount = data.amount / data.count;
        const suggestedBudget = Math.round(monthlyIncome * 0.2);
        const estimatedMonths = Math.ceil(avgAmount / suggestedBudget);
        
        return {
          name: name.length > 50 ? name.substring(0, 50) + '...' : name,
          category: 'Purchases',
          estimatedPrice: Math.round(avgAmount),
          estimatedMonths: Math.max(1, Math.min(estimatedMonths, 24)),
          merchant: data.merchant,
          lastTransactionDate: data.dates[0],
        };
      })
      .sort((a, b) => b.estimatedPrice - a.estimatedPrice)
      .slice(0, 5);
    
    return { suggestions };
  }
}

export const smartSaverService = new SmartSaverService();

export { weightedAverage, calculateTimeSpanMonths, calculateConfidenceScore, categorizeByDataPoints, getUniqueMonths, classifyExpenseFrequency };
