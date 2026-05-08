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

async predictSpending(userId: string, input: PredictSpendingInput) {
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

    if (transactions.length === 0) {
      return {
        predictions: [],
        totalPredicted: 0,
        totalBudget: 0,
        totalSpent: 0,
        period: `Bulan ${new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}`,
        message: 'Data transaksi masih kurang dari 3 bulan. Tambahkan lebih banyak transaksi untuk mendapatkan prediksi yang akurat.',
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
      const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length;
      const lastMonth = amounts.slice(-Math.min(amounts.length, 4));
      const lastAvg = lastMonth.reduce((a, b) => a + b, 0) / lastMonth.length;
      const prevMonth = amounts.slice(-Math.min(amounts.length, 8), -4);
      const prevAvg = prevMonth.length > 0 ? prevMonth.reduce((a, b) => a + b, 0) / lastAvg : lastAvg;
      
      const change = (lastAvg - prevAvg) / (prevAvg || 1);
      const trend = change > 0.1 ? 'increasing' : change < -0.1 ? 'decreasing' : 'stable';
      const confidence = amounts.length >= 20 ? 'high' : amounts.length >= 10 ? 'medium' : 'low';
      
      const budgetLimit = budgetMap[category];
      const isOverBudget = budgetLimit && lastAvg > budgetLimit;
      
      return {
        category,
        predictedAmount: Math.round(lastAvg * (1 + change * 0.5)),
        currentAverage: Math.round(avg),
        budgetLimit: budgetLimit || undefined,
        isOverBudget,
        trend,
        confidence,
      };
    });

    const totalPredicted = predictions.reduce((sum, p) => sum + p.predictedAmount, 0);
    const totalBudget = budgets.reduce((sum, b) => sum + Number(b.amount), 0);
    const totalSpent = transactions.reduce((sum, t) => sum + Number(t.amount), 0);

    // Generate contextual message
    let message = `Berdasarkan data ${months} bulan terakhir, prediksi pengeluaran bulan depan adalah ${totalPredicted.toLocaleString('id-ID')}.`;
    if (totalBudget > 0) {
      const budgetUsagePercent = Math.round((totalSpent / totalBudget) * 100);
      message += ` Penggunaan budget bulan ini: ${budgetUsagePercent}%.`;
    }
    if (totalBalance > 0) {
      message += ` Total saldo akun: ${totalBalance.toLocaleString('id-ID')}.`;
    }

    return {
      predictions: predictions.sort((a, b) => b.predictedAmount - a.predictedAmount),
      totalPredicted,
      totalBudget,
      totalSpent,
      period: `Bulan ${new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}`,
      message,
      insufficientData: false,
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

    // Get transactions for this month
    const transactions = await prisma.transaction.findMany({
      where: {
        userId,
        date: { gte: startOfMonth, lte: endOfMonth },
      },
      include: { category: true },
    });

    // Get accounts for total balance
    const accounts = await prisma.account.findMany({
      where: { userId, isArchived: false },
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

    // Calculate monthly totals
    const income = transactions.filter(t => t.type === 'INCOME').reduce((sum, t) => sum + Number(t.amount), 0);
    const expenses = transactions.filter(t => t.type === 'EXPENSE').reduce((sum, t) => sum + Number(t.amount), 0);
    const balance = income - expenses;

    const suggestions: SavingSuggestion[] = [];

    // Suggest based on positive balance
    if (balance > 0) {
      const remainingToEmergency = Math.max(0, (income * 6) - totalBalance);
      if (remainingToEmergency > 0 && remainingToEmergency < balance) {
        suggestions.push({
          category: 'Dana Darurat',
          currentSpending: 0,
          suggestedSaving: Math.min(Math.round(balance * 0.5), remainingToEmergency),
          reason: `Tambahkan ke dana darurat. Sisa yang dibutuhkan: ${remainingToEmergency.toLocaleString('id-ID')}`,
        });
      } else {
        suggestions.push({
          category: 'Tabungan Umum',
          currentSpending: 0,
          suggestedSaving: Math.round(balance * 0.5),
          reason: 'Anda memiliki sisa saldo positif bulan ini. Simpan setidaknya 50% untuk masa depan.',
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

    // General suggestions based on income
    if (income > 0 && balance <= 0) {
      suggestions.push({
        category: 'Kurangi Defisit',
        currentSpending: expenses,
        suggestedSaving: Math.round(income * 0.05),
        reason: `Pengeluaran melebihi pendapatan. Coba hemat minimal 5% (${Math.round(income * 0.05).toLocaleString('id-ID')}) dari pengeluaran untuk mulai menabung.`,
      });
    }

    // Account-based suggestion
    if (totalBalance > income * 3) {
      suggestions.push({
        category: 'Investasi',
        currentSpending: 0,
        suggestedSaving: Math.round(totalBalance * 0.1),
        reason: `Total saldo Anda (${totalBalance.toLocaleString('id-ID')}) sudah sehat. Pertimbangkan investasi 10% untuk pertumbuhan.`,
      });
    }

    return {
      suggestions: suggestions.slice(0, 5),
      currentBalance: balance,
      totalAccountBalance: totalBalance,
      activeGoalsCount: goals.length,
      monthlyIncome: income,
      monthlyExpenses: expenses,
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
