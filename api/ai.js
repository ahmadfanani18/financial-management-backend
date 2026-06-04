import { getPrisma, parseBody, setupCors, parseToken } from './utils.js';

export default async function handler(req, res) {
  let db = null;
  try {
    const origin = req.headers.origin;
    setupCors(res, origin);

    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    res.setHeader('Content-Type', 'application/json');
    const url = (req.url || '/').split('?')[0];
    const method = req.method;

    const token = parseToken(req.headers.authorization);
    if (!token) {
      res.status(401).send(JSON.stringify({ message: 'Unauthorized' }));
      return;
    }

    db = await getPrisma();

    // POST /api/ai/generate-plan
    if (url === '/api/ai/generate-plan' && method === 'POST') {
      const body = parseBody(req.body);
      const { monthlyIncome, currency } = body || {};

      if (!monthlyIncome) {
        res.status(400).send(JSON.stringify({ error: 'monthlyIncome required' }));
        return;
      }

      const needs = Math.round(monthlyIncome * 0.50);
      const wants = Math.round(monthlyIncome * 0.30);
      const savings = Math.round(monthlyIncome * 0.20);

      const expenses = [
        { category: 'Food & Dining', percentage: 15, amount: Math.round(needs * 0.30), type: 'EXPENSE' },
        { category: 'Transportation', percentage: 10, amount: Math.round(needs * 0.20), type: 'EXPENSE' },
        { category: 'Bills & Utilities', percentage: 15, amount: Math.round(needs * 0.30), type: 'EXPENSE' },
        { category: 'Housing', percentage: 30, amount: Math.round(needs * 0.60), type: 'EXPENSE' },
        { category: 'Healthcare', percentage: 5, amount: Math.round(needs * 0.10), type: 'EXPENSE' },
        { category: 'Entertainment', percentage: 10, amount: Math.round(wants * 0.33), type: 'EXPENSE' },
        { category: 'Shopping', percentage: 10, amount: Math.round(wants * 0.33), type: 'EXPENSE' },
        { category: 'Other Wants', percentage: 10, amount: Math.round(wants * 0.34), type: 'EXPENSE' },
      ];

      const savingsAllocation = [
        { category: 'Emergency Fund', percentage: 10, amount: Math.round(savings * 0.50), type: 'SAVING' },
        { category: 'Investment', percentage: 5, amount: Math.round(savings * 0.25), type: 'SAVING' },
        { category: 'Goals', percentage: 5, amount: Math.round(savings * 0.25), type: 'SAVING' },
      ];

      res.status(200).send(JSON.stringify({
        summary: { monthlyIncome, needs, wants, savings, currency: currency || 'IDR' },
        expenses,
        savings: savingsAllocation,
        milestones: [],
        suggestedGoal: {
          name: 'Dana Darurat',
          targetAmount: needs * 6,
          deadline: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        },
        message: `Berdasarkan aturan 50/30/20, Anda bisa mengalokasikan ${needs.toLocaleString('id-ID')} untuk kebutuhan (50%), ${wants.toLocaleString('id-ID')} untuk keinginan (30%), dan ${savings.toLocaleString('id-ID')} untuk tabungan (20%).`,
      }));
      return;
    }

    // POST /api/ai/generate-plan-from-data
    if (url === '/api/ai/generate-plan-from-data' && method === 'POST') {
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

      const accounts = await db.account.findMany({
        where: { userId: token.userId, isArchived: false },
        select: { balance: true },
      });
      const totalBalance = accounts.reduce((sum, acc) => sum + parseFloat(acc.balance), 0);

      const transactions = await db.transaction.findMany({
        where: { userId: token.userId, date: { gte: threeMonthsAgo } },
        include: { category: true },
      });

      if (transactions.length < 5) {
        res.status(400).send(JSON.stringify({
          error: true,
          message: 'Data transaksi tidak cukup. Tambahkan minimal 5 transaksi termasuk pendapatan untuk menghasilkan rencana.',
        }));
        return;
      }

      const transactionDates = transactions.map(t => new Date(t.date).getTime());
      const minDate = Math.min(...transactionDates);
      const maxDate = Math.max(...transactionDates);
      const actualMonths = Math.max(1, Math.ceil((maxDate - minDate) / (30 * 24 * 60 * 60 * 1000)));

      const totalIncome = transactions
        .filter(t => t.type === 'INCOME')
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);
      const monthlyIncome = totalIncome / actualMonths;

      const totalExpense = transactions
        .filter(t => t.type === 'EXPENSE')
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);
      const monthlyExpense = totalExpense / actualMonths;

      const expenseByCategory = {};
      transactions.filter(t => t.type === 'EXPENSE').forEach(t => {
        const catName = t.category?.name || 'Lainnya';
        expenseByCategory[catName] = (expenseByCategory[catName] || 0) + parseFloat(t.amount);
      });

      const topExpenses = Object.entries(expenseByCategory).sort((a, b) => b[1] - a[1]).slice(0, 5);

      const savings = monthlyIncome - monthlyExpense;
      const savingsDisplay = savings > 0 ? savings.toLocaleString('id-ID') : `Terjadi deficit ${Math.abs(savings).toLocaleString('id-ID')}`;

      const endDate = new Date();
      endDate.setFullYear(endDate.getFullYear() + 1);

      const milestones = [];
      const emergencyFundTarget = monthlyExpense * 6;
      milestones.push({
        id: `temp-0`,
        title: 'Dana Darurat',
        description: `Tujuan: ${emergencyFundTarget.toLocaleString('id-ID')} (~${Math.round((emergencyFundTarget / monthlyIncome) * 100)}% dari pendapatan 6 bulan)`,
        targetDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
        targetAmount: emergencyFundTarget,
        isCompleted: false,
        order: 0,
      });

      if (topExpenses.length > 0) {
        const [topCategory, amount] = topExpenses[0];
        milestones.push({
          id: `temp-1`,
          title: `Kurangi Pengeluaran ${topCategory}`,
          description: `Kurangi ${(amount * 0.2).toLocaleString('id-ID')}/bulan dari kategori ${topCategory}`,
          targetDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
          targetAmount: amount * 0.2 * 3,
          isCompleted: false,
          order: 1,
        });
      }

      if (savings > 0) {
        milestones.push({
          id: `temp-2`,
          title: 'Tabungan Tahunan',
          description: `Tabungan ${Math.round(monthlyIncome * 0.2).toLocaleString('id-ID')}/bulan`,
          targetDate: endDate.toISOString(),
          targetAmount: monthlyIncome * 0.2 * 12,
          isCompleted: false,
          order: 2,
        });
      }

      res.status(200).send(JSON.stringify({
        plan: {
          name: `Rencana Keuangan ${new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}`,
          description: `Rencana berdasarkan ${actualMonths} bulan terakhir. Pendapatan: ${Math.round(monthlyIncome).toLocaleString('id-ID')}/bulan, Pengeluaran: ${Math.round(monthlyExpense).toLocaleString('id-ID')}/bulan.`,
          startDate: new Date().toISOString(),
          endDate: endDate.toISOString(),
          status: 'ACTIVE',
          milestones,
        },
        summary: {
          totalBalance: totalBalance.toLocaleString('id-ID'),
          monthlyIncome: Math.round(monthlyIncome).toLocaleString('id-ID'),
          monthlyExpense: Math.round(monthlyExpense).toLocaleString('id-ID'),
          savings: savingsDisplay,
          topExpenses: topExpenses.slice(0, 3).map(([cat, amt]) => ({ category: cat, amount: amt })),
        },
      }));
      return;
    }

    // POST /api/ai/predict-spending
    if (url === '/api/ai/predict-spending' && method === 'POST') {
      const body = parseBody(req.body);
      const months = body?.months || 3;

      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - months);

      const transactions = await db.transaction.findMany({
        where: { userId: token.userId, type: 'EXPENSE', date: { gte: startDate } },
        include: { category: true },
      });

      if (transactions.length === 0) {
        res.status(200).send(JSON.stringify({
          predictions: [],
          totalPredicted: 0,
          totalBudget: 0,
          totalSpent: 0,
          period: `Bulan ${new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}`,
          message: 'Data transaksi masih kurang. Tambahkan lebih banyak transaksi untuk prediksi.',
          insufficientData: true,
        }));
        return;
      }

      const categoryMap = {};
      transactions.forEach(t => {
        const catName = t.category?.name || 'Other';
        if (!categoryMap[catName]) categoryMap[catName] = [];
        categoryMap[catName].push(parseFloat(t.amount));
      });

      const predictions = Object.entries(categoryMap).map(([category, amounts]) => {
        const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length;
        return {
          category,
          predictedAmount: Math.round(avg),
          currentAverage: Math.round(avg),
          trend: 'stable',
          confidence: amounts.length > 10 ? 'high' : amounts.length > 5 ? 'medium' : 'low',
          dataPoints: amounts.length,
        };
      });

      const totalPredicted = predictions.reduce((sum, p) => sum + p.predictedAmount, 0);
      const totalSpent = transactions.reduce((sum, t) => sum + parseFloat(t.amount), 0);

      res.status(200).send(JSON.stringify({
        predictions: predictions.sort((a, b) => b.predictedAmount - a.predictedAmount),
        totalPredicted,
        totalBudget: 0,
        totalSpent,
        period: `Bulan ${new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}`,
        message: `Prediksi pengeluaran bulan ini: ${totalPredicted.toLocaleString('id-ID')}`,
        insufficientData: false,
      }));
      return;
    }

    // POST /api/ai/suggest-savings
    if (url === '/api/ai/suggest-savings' && method === 'POST') {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      const transactions = await db.transaction.findMany({
        where: { userId: token.userId, date: { gte: startOfMonth, lte: endOfMonth } },
        include: { category: true },
      });

      const accounts = await db.account.findMany({
        where: { userId: token.userId, isArchived: false, isLocked: false },
        select: { balance: true },
      });
      const totalBalance = accounts.reduce((sum, acc) => sum + parseFloat(acc.balance), 0);

      const goals = await db.goal.findMany({
        where: { userId: token.userId, status: 'ACTIVE' },
        select: { name: true, currentAmount: true, targetAmount: true, deadline: true },
      });

      const income = transactions.filter(t => t.type === 'INCOME').reduce((sum, t) => sum + parseFloat(t.amount), 0);
      const expenses = transactions.filter(t => t.type === 'EXPENSE').reduce((sum, t) => sum + parseFloat(t.amount), 0);
      const balance = income - expenses;

      const suggestions = [];

      if (balance > 0) {
        suggestions.push({
          category: 'Tabungan Umum',
          currentSpending: 0,
          suggestedSaving: Math.round(balance * 0.5),
          reason: 'Anda memiliki sisa saldo positif. Simpan 50% untuk masa depan.',
        });
      }

      if (income > 0 && balance <= 0) {
        suggestions.push({
          category: 'Kurangi Defisit',
          currentSpending: expenses,
          suggestedSaving: Math.round(income * 0.05),
          reason: `Hemat minimal 5% (${Math.round(income * 0.05).toLocaleString('id-ID')}) untuk mulai menabung.`,
        });
      }

      res.status(200).send(JSON.stringify({
        suggestions: suggestions.slice(0, 5),
        currentBalance: balance,
        totalAccountBalance: totalBalance,
        activeGoalsCount: goals.length,
        monthlyIncome: income,
        monthlyExpenses: expenses,
        message: suggestions.length > 0 ? `Ditemukan ${suggestions.length} saran.` : 'Pertahankan kebiasaan baik!',
      }));
      return;
    }

    // POST /api/ai/smart-saver/calculate
    const smartSaverMatch = url.match(/^\/api\/ai\/smart-saver\/calculate$/i);
    if (smartSaverMatch && method === 'POST') {
      const body = parseBody(req.body);
      const { targetPrice, monthlyBudget } = body || {};

      if (!targetPrice) {
        res.status(400).send(JSON.stringify({ error: 'targetPrice required' }));
        return;
      }

      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

      const accounts = await db.account.findMany({
        where: { userId: token.userId, isArchived: false, isLocked: false },
        select: { balance: true },
      });
      const totalBalance = accounts.reduce((sum, acc) => sum + parseFloat(acc.balance), 0);

      const incomeTx = await db.transaction.findMany({
        where: { userId: token.userId, date: { gte: threeMonthsAgo }, type: 'INCOME' },
      });

      const incomeByMonth = {};
      incomeTx.forEach(t => {
        const monthKey = `${new Date(t.date).getFullYear()}-${String(new Date(t.date).getMonth() + 1).padStart(2, '0')}`;
        if (!incomeByMonth[monthKey]) incomeByMonth[monthKey] = [];
        incomeByMonth[monthKey].push(parseFloat(t.amount));
      });

      const monthlyIncomeValues = Object.values(incomeByMonth).map(amounts => Math.max(...amounts));
      const monthlyIncome = monthlyIncomeValues.length > 0
        ? monthlyIncomeValues.reduce((sum, val) => sum + val, 0) / monthlyIncomeValues.length
        : 0;

      const budgets = await db.budget.findMany({
        where: { userId: token.userId, isActive: true },
        include: { category: true },
      });
      const totalBudgetAmount = budgets.reduce((sum, b) => sum + parseFloat(b.amount), 0);

      const activeGoals = await db.goal.findMany({
        where: { userId: token.userId, status: 'ACTIVE' },
      });

      let existingContribution = 0;
      activeGoals.forEach(goal => {
        const remaining = parseFloat(goal.targetAmount) - parseFloat(goal.currentAmount);
        if (remaining > 0) {
          const daysLeft = Math.max(1, Math.ceil((new Date(goal.deadline).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
          const monthsLeft = Math.max(1, daysLeft / 30);
          existingContribution += remaining / monthsLeft;
        }
      });

      const availableForSavings = monthlyIncome - totalBudgetAmount;
      const remainingForGoal = Math.max(0, availableForSavings - existingContribution);

      const options = [
        { label: 'Conservative', monthlyNeeded: Math.round(targetPrice / 12), estimatedMonths: 12, feasibility: 'safe' },
        { label: 'Balanced', monthlyNeeded: Math.round(targetPrice / 6), estimatedMonths: 6, feasibility: 'tight' },
        { label: 'Aggressive', monthlyNeeded: Math.round(targetPrice / 3), estimatedMonths: 3, feasibility: 'aggressive' },
      ];

      res.status(200).send(JSON.stringify({
        options,
        recommended: remainingForGoal > targetPrice / 6 ? 'conservative' : remainingForGoal > targetPrice / 12 ? 'balanced' : 'aggressive',
        progress: 0,
        remainingNeeded: targetPrice,
        startDate: now.toISOString(),
        insight: `Sisa tersedia untuk ditabung: ${Math.round(remainingForGoal).toLocaleString('id-ID')}/bulan.`,
        context: {
          monthlyIncome: Math.round(monthlyIncome),
          monthlyExpense: Math.round(totalBudgetAmount),
          totalBalance: Math.round(totalBalance),
          existingGoalsCount: activeGoals.length,
          existingGoalMonthlyContribution: Math.round(existingContribution),
        },
      }));
      return;
    }

    // GET /api/ai/smart-saver/suggestions
    const suggestionsMatch = url.match(/^\/api\/ai\/smart-saver\/suggestions$/i);
    if (suggestionsMatch && method === 'GET') {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const transactions = await db.transaction.findMany({
        where: { userId: token.userId, date: { gte: sixMonthsAgo }, type: 'EXPENSE' },
        include: { category: true },
        orderBy: { date: 'desc' },
      });

      const patternGroups = {};
      transactions.forEach(t => {
        const merchant = t.description || 'Unknown';
        if (parseFloat(t.amount) > 50000) {
          if (!patternGroups[merchant]) {
            patternGroups[merchant] = { amount: 0, count: 0, dates: [], merchant };
          }
          patternGroups[merchant].amount += parseFloat(t.amount);
          patternGroups[merchant].count += 1;
          patternGroups[merchant].dates.push(t.date.toISOString());
        }
      });

      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      const incomeTx = await db.transaction.findMany({
        where: { userId: token.userId, date: { gte: threeMonthsAgo }, type: 'INCOME' },
      });
      const monthlyIncome = incomeTx.reduce((sum, t) => sum + parseFloat(t.amount), 0) / 3;
      const suggestedBudget = Math.round(monthlyIncome * 0.2);

      const suggestions = Object.entries(patternGroups)
        .filter(([, data]) => data.count >= 1)
        .map(([name, data]) => ({
          name: name.length > 50 ? name.substring(0, 50) + '...' : name,
          category: 'Purchases',
          estimatedPrice: Math.round(data.amount / data.count),
          estimatedMonths: Math.max(1, Math.min(Math.ceil((data.amount / data.count) / suggestedBudget), 24)),
          merchant: data.merchant,
          lastTransactionDate: data.dates[0],
        }))
        .sort((a, b) => b.estimatedPrice - a.estimatedPrice)
        .slice(0, 5);

      res.status(200).send(JSON.stringify({ suggestions }));
      return;
    }

    res.status(404).send(JSON.stringify({ error: 'Not found', url, method }));
  } catch (err) {
    console.error('AI handler error:', err);
    res.status(500).send(JSON.stringify({ message: 'Internal server error', error: String(err) }));
  } finally {
    if (db) {
      try { await db.$disconnect(); } catch {}
    }
  }
}