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
  predictedAmount: number;
  currentAverage: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  confidence: 'high' | 'medium' | 'low';
}

interface SavingSuggestion {
  category: string;
  currentSpending: number;
  suggestedSaving: number;
  reason: string;
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
    const sixMonths = 180 * 24 * 60 * 60 * 1000;
    const threeMonths = 90 * 24 * 60 * 60 * 1000;

    const emergencyFundTarget = estimatedExpense * 6;
    milestones.push({
      id: `temp-${milestones.length}`,
      title: 'Dana Darurat',
      description: `Tujuan: ${emergencyFundTarget.toLocaleString('id-ID')} (~${Math.round((emergencyFundTarget / monthlyIncome) * 100)}% dari pendapatan 6 bulan)`,
      targetDate: new Date(now + oneYear).toISOString(),
      targetAmount: emergencyFundTarget,
      isSelected: false,
    });

    if (monthlyIncome >= 10000000) {
      const investmentTarget = monthlyIncome * 0.1 * 12;
      milestones.push({
        id: `temp-${milestones.length}`,
        title: 'Mulai Investasi',
        description: `Investasi ${Math.round(monthlyIncome * 0.1).toLocaleString('id-ID')}/bulan`,
        targetDate: new Date(now + sixMonths).toISOString(),
        targetAmount: investmentTarget,
        isSelected: false,
      });
    }

    if (dependents > 0) {
      const educationTarget = monthlyIncome * 0.15 * 12 * 5;
      milestones.push({
        id: `temp-${milestones.length}`,
        title: 'Tabungan Pendidikan Anak',
        description: `Tabungan ${Math.round(monthlyIncome * 0.15).toLocaleString('id-ID')}/bulan untuk ${dependents} anak`,
        targetDate: new Date(now + oneYear * 5).toISOString(),
        targetAmount: educationTarget,
        isSelected: false,
      });
    }

    if (monthlyIncome * 0.3 > 2000000) {
      const reductionTarget = (monthlyIncome * 0.3 - 2000000) * 0.2;
      milestones.push({
        id: `temp-${milestones.length}`,
        title: 'Kurangi Pengeluaran Hiburan',
        description: `Kurangi ${Math.round(reductionTarget).toLocaleString('id-ID')}/bulan dari pengeluaran wants`,
        targetDate: new Date(now + threeMonths).toISOString(),
        targetAmount: reductionTarget * 3,
        isSelected: false,
      });
    }

    const annualSavingsTarget = monthlyIncome * 0.2 * 12;
    milestones.push({
      id: `temp-${milestones.length}`,
      title: 'Tabungan Tahunan',
      description: `Tabungan ${Math.round(monthlyIncome * 0.2).toLocaleString('id-ID')}/bulan`,
      targetDate: new Date(now + oneYear).toISOString(),
      targetAmount: annualSavingsTarget,
      isSelected: false,
    });

    if (monthlyIncome >= 20000000) {
      const houseTarget = monthlyIncome * 0.3 * 24;
      milestones.push({
        id: `temp-${milestones.length}`,
        title: 'Tabungan Rumah',
        description: `Uang muka rumah - tabungan ${Math.round(monthlyIncome * 0.3).toLocaleString('id-ID')}/bulan`,
        targetDate: new Date(now + oneYear * 2).toISOString(),
        targetAmount: houseTarget,
        isSelected: false,
      });
    }

    return milestones;
  }

  async predictSpending(userId: string, input: PredictSpendingInput) {
    const { months } = input;
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    const transactions = await prisma.transaction.findMany({
      where: {
        userId,
        type: 'EXPENSE',
        date: { gte: startDate },
      },
      include: { category: true },
    });

    if (transactions.length === 0) {
      return {
        predictions: [],
        totalPredicted: 0,
        period: `Bulan ${new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}`,
        message: 'Data transaksi masih kurang dari 3 bulan. Tambahkan lebih banyak transaksi untuk mendapatkan prediksi yang akurat.',
        insufficientData: true,
      };
    }

    const categoryMap: Record<string, number[]> = {};
    
    transactions.forEach(t => {
      const catName = t.category?.name || 'Other';
      if (!categoryMap[catName]) {
        categoryMap[catName] = [];
      }
      categoryMap[catName].push(Number(t.amount));
    });

    const predictions: SpendingPrediction[] = Object.entries(categoryMap).map(([category, amounts]) => {
      const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length;
      const lastMonth = amounts.slice(-Math.min(amounts.length, 4));
      const lastAvg = lastMonth.reduce((a, b) => a + b, 0) / lastMonth.length;
      const prevMonth = amounts.slice(-Math.min(amounts.length, 8), -4);
      const prevAvg = prevMonth.length > 0 ? prevMonth.reduce((a, b) => a + b, 0) / prevMonth.length : lastAvg;
      
      const change = (lastAvg - prevAvg) / (prevAvg || 1);
      const trend = change > 0.1 ? 'increasing' : change < -0.1 ? 'decreasing' : 'stable';
      const confidence = amounts.length >= 20 ? 'high' : amounts.length >= 10 ? 'medium' : 'low';
      
      return {
        category,
        predictedAmount: Math.round(lastAvg * (1 + change * 0.5)),
        currentAverage: Math.round(avg),
        trend,
        confidence,
      };
    });

    const totalPredicted = predictions.reduce((sum, p) => sum + p.predictedAmount, 0);

    return {
      predictions: predictions.sort((a, b) => b.predictedAmount - a.predictedAmount),
      totalPredicted,
      period: `Bulan ${new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}`,
      message: `Berdasarkan data ${months} bulan terakhir, prediksi pengeluaran bulan depan adalah ${totalPredicted.toLocaleString('id-ID')}.`,
      insufficientData: false,
    };
  }

  async suggestSavings(userId: string) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const transactions = await prisma.transaction.findMany({
      where: {
        userId,
        date: { gte: startOfMonth, lte: endOfMonth },
      },
      include: { category: true },
    });

    const income = transactions.filter(t => t.type === 'INCOME').reduce((sum, t) => sum + Number(t.amount), 0);
    const expenses = transactions.filter(t => t.type === 'EXPENSE').reduce((sum, t) => sum + Number(t.amount), 0);
    const balance = income - expenses;

    const suggestions: SavingSuggestion[] = [];

    if (balance > 0) {
      suggestions.push({
        category: 'Tabungan Umum',
        currentSpending: 0,
        suggestedSaving: Math.round(balance * 0.5),
        reason: 'Anda memiliki sisa saldo positif bulan ini. Simpan setidaknya 50% untuk dana darurat.',
      });
    }

    const categorySpending: Record<string, number> = {};
    transactions.filter(t => t.type === 'EXPENSE').forEach(t => {
      const catName = t.category?.name || 'Other';
      categorySpending[catName] = (categorySpending[catName] || 0) + Number(t.amount);
    });

    const topCategories = Object.entries(categorySpending)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    topCategories.forEach(([category, amount]) => {
      if (amount > income * 0.2) {
        suggestions.push({
          category,
          currentSpending: amount,
          suggestedSaving: Math.round(amount * 0.1),
          reason: `Pengeluaran untuk ${category} mencapai ${Math.round((amount / income) * 100)}% dari pendapatan. Pertimbangkan untuk mengurangi 10%.`,
        });
      }
    });

    return {
      suggestions: suggestions.slice(0, 5),
      currentBalance: balance,
      message: suggestions.length > 0 
        ? `Ditemukan ${suggestions.length} saran untuk meningkatkan tabungan Anda.`
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
    const monthlyExpense = totalExpense / actualMonths;

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

    const savings = monthlyIncome - monthlyExpense;
    const savingsDisplay = savings > 0 
      ? savings.toLocaleString('id-ID')
      : `Terjadi deficit ${Math.abs(savings).toLocaleString('id-ID')}`;

    const planName = `Rencana Keuangan ${new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}`;
    const startDate = new Date();
    const endDate = new Date();
    endDate.setFullYear(endDate.getFullYear() + 1);

    const milestones: Array<{title: string; description: string; targetDate: Date; targetAmount: number}> = [];

    const emergencyFundTarget = monthlyExpense * 6;
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

    if (totalBalance > monthlyExpense * 3 && savings > 0) {
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
        description: `Rencana keuangan berdasarkan analisis data ${actualMonths} bulan terakhir. Pendapatan rata-rata: ${Math.round(monthlyIncome).toLocaleString('id-ID')}/bulan, Pengeluaran: ${Math.round(monthlyExpense).toLocaleString('id-ID')}/bulan.`,
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
        monthlyExpense: Math.round(monthlyExpense).toLocaleString('id-ID'),
        savings: savingsDisplay,
        topExpenses: topExpenses.slice(0, 3).map(([cat, amt]) => ({ category: cat, amount: amt })),
      },
    };
  }
}

export const aiService = new AIService();
