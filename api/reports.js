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
    const queryParams = new URL(req.url, 'http://localhost').searchParams;

    // GET pricing (public)
    if (url === '/api/pricing' && method === 'GET') {
      db = await getPrisma();
      const pricings = await db.pricing.findMany({ orderBy: { app: 'asc' } });
      res.status(200).send(JSON.stringify(pricings));
      return;
    }

    const token = parseToken(req.headers.authorization);
    if (!token) {
      res.status(401).send(JSON.stringify({ message: 'Unauthorized' }));
      return;
    }

    db = await getPrisma();

    // GET monthly report
    if (url === '/api/reports/monthly' && method === 'GET') {
      const year = parseInt(queryParams.get('year') || new Date().getFullYear());
      const month = parseInt(queryParams.get('month') || (new Date().getMonth() + 1));
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59, 999);

      const transactions = await db.transaction.findMany({
        where: { userId: token.userId, date: { gte: startDate, lte: endDate } },
        include: { category: true, account: true },
      });

      const income = transactions.filter(t => t.type === 'INCOME');
      const expense = transactions.filter(t => t.type === 'EXPENSE');
      const transfer = transactions.filter(t => t.type === 'TRANSFER');

      const groupByCategory = (txs) => {
        const grouped = {};
        txs.forEach(t => {
          const catName = t.category?.name || 'Other';
          if (!grouped[catName]) {
            grouped[catName] = { name: catName, amount: 0, color: t.category?.color || '#6B7280' };
          }
          grouped[catName].amount += parseFloat(t.amount);
        });
        return Object.values(grouped).sort((a, b) => b.amount - a.amount);
      };

      res.status(200).send(JSON.stringify({
        period: {
          year,
          month,
          label: startDate.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }),
        },
        summary: {
          totalIncome: income.reduce((sum, t) => sum + parseFloat(t.amount), 0),
          totalExpense: expense.reduce((sum, t) => sum + parseFloat(t.amount), 0),
          totalTransfer: transfer.reduce((sum, t) => sum + parseFloat(t.amount), 0),
          balance: income.reduce((sum, t) => sum + parseFloat(t.amount), 0) - expense.reduce((sum, t) => sum + parseFloat(t.amount), 0),
        },
        incomeByCategory: groupByCategory(income),
        expenseByCategory: groupByCategory(expense),
        transactions: transactions.slice(0, 50),
      }));
      return;
    }

    // GET category breakdown
    if (url === '/api/reports/category-breakdown' && method === 'GET') {
      const startDate = queryParams.get('startDate');
      const endDate = queryParams.get('endDate');
      
      if (!startDate || !endDate) {
        res.status(400).send(JSON.stringify({ message: 'startDate and endDate required' }));
        return;
      }

      const transactions = await db.transaction.findMany({
        where: {
          userId: token.userId,
          type: 'EXPENSE',
          date: { gte: new Date(startDate), lte: new Date(endDate) },
        },
        include: { category: true },
      });

      const breakdown = {};
      const total = transactions.reduce((sum, t) => sum + parseFloat(t.amount), 0);

      transactions.forEach(t => {
        const catName = t.category?.name || 'Other';
        if (!breakdown[catName]) {
          breakdown[catName] = { name: catName, amount: 0, color: t.category?.color || '#6B7280', percentage: 0 };
        }
        breakdown[catName].amount += parseFloat(t.amount);
      });

      Object.values(breakdown).forEach(cat => {
        cat.percentage = total > 0 ? Math.round((cat.amount / total) * 100) : 0;
      });

      res.status(200).send(JSON.stringify({
        total,
        categories: Object.values(breakdown).sort((a, b) => b.amount - a.amount),
      }));
      return;
    }

    // GET trends
    if (url === '/api/reports/trends' && method === 'GET') {
      const months = parseInt(queryParams.get('months') || '6');
      const now = new Date();
      const trends = [];

      for (let i = months - 1; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);

        const transactions = await db.transaction.findMany({
          where: { userId: token.userId, date: { gte: date, lte: endDate } },
        });

        const income = transactions.filter(t => t.type === 'INCOME').reduce((sum, t) => sum + parseFloat(t.amount), 0);
        const expense = transactions.filter(t => t.type === 'EXPENSE').reduce((sum, t) => sum + parseFloat(t.amount), 0);
        const transfer = transactions.filter(t => t.type === 'TRANSFER').reduce((sum, t) => sum + parseFloat(t.amount), 0);

        trends.push({
          month: date.toLocaleDateString('id-ID', { month: 'short' }),
          year: date.getFullYear(),
          income: Math.round(income),
          expense: Math.round(expense),
          transfer: Math.round(transfer),
          balance: Math.round(income - expense),
        });
      }

      res.status(200).send(JSON.stringify({ trends }));
      return;
    }

    // GET cash flow
    if (url === '/api/reports/cash-flow' && method === 'GET') {
      const startDate = queryParams.get('startDate');
      const endDate = queryParams.get('endDate');
      
      if (!startDate || !endDate) {
        res.status(400).send(JSON.stringify({ message: 'startDate and endDate required' }));
        return;
      }

      const transactions = await db.transaction.findMany({
        where: { userId: token.userId, date: { gte: new Date(startDate), lte: new Date(endDate) } },
        include: { account: true },
      });

      const dailyFlow = {};
      transactions.forEach(t => {
        const dateKey = new Date(t.date).toISOString().split('T')[0];
        if (!dailyFlow[dateKey]) {
          dailyFlow[dateKey] = { income: 0, expense: 0 };
        }
        if (t.type === 'INCOME') {
          dailyFlow[dateKey].income += parseFloat(t.amount);
        } else if (t.type === 'EXPENSE') {
          dailyFlow[dateKey].expense += parseFloat(t.amount);
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

      res.status(200).send(JSON.stringify({ dailyFlow: sortedDays }));
      return;
    }

    // GET mutations
    if (url.match(/^\/api\/reports\/mutations$/i) && method === 'GET') {
      const accountId = queryParams.get('accountId');
      const startDate = queryParams.get('startDate');
      const endDate = queryParams.get('endDate');
      const search = queryParams.get('search');
      const page = parseInt(queryParams.get('page') || '1');
      const limit = parseInt(queryParams.get('limit') || '50');

      if (!accountId || !startDate || !endDate) {
        res.status(400).send(JSON.stringify({ message: 'accountId, startDate, endDate required' }));
        return;
      }

      const account = await db.account.findFirst({ where: { id: accountId, userId: token.userId } });
      if (!account) {
        res.status(404).send(JSON.stringify({ message: 'Akun tidak ditemukan' }));
        return;
      }

      const startDateObj = new Date(startDate);
      const dayBeforeStart = new Date(startDateObj);
      dayBeforeStart.setDate(dayBeforeStart.getDate() - 1);
      dayBeforeStart.setHours(23, 59, 59, 999);

      const prevTransactions = await db.transaction.findMany({
        where: {
          OR: [{ accountId }, { fromAccountId: accountId }, { toAccountId: accountId }],
          userId: token.userId,
          date: { lte: dayBeforeStart },
        },
      });

      let startingBalance = parseFloat(account.balance);
      for (const t of prevTransactions) {
        if (t.type === 'INCOME' || (t.type === 'TRANSFER' && t.toAccountId === accountId)) {
          startingBalance -= parseFloat(t.amount);
        } else if (t.type === 'EXPENSE' || (t.type === 'TRANSFER' && t.fromAccountId === accountId)) {
          startingBalance += parseFloat(t.amount);
        }
      }

      const where = {
        OR: [{ accountId }, { fromAccountId: accountId }, { toAccountId: accountId }],
        userId: token.userId,
        date: { gte: new Date(startDate), lte: new Date(endDate) },
      };
      if (search) where.description = { contains: search, mode: 'insensitive' };

      const [transactions, total] = await Promise.all([
        db.transaction.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { date: 'asc' },
          include: { category: true, toAccount: true },
        }),
        db.transaction.count({ where }),
      ]);

      let runningBalance = startingBalance;
      let totalIncome = 0;
      let totalExpense = 0;
      let transferIn = 0;
      let transferOut = 0;

      const transactionsWithBalance = transactions.map(t => {
        let change = 0;
        if (t.type === 'INCOME') {
          change = parseFloat(t.amount);
          totalIncome += change;
        } else if (t.type === 'EXPENSE') {
          change = -parseFloat(t.amount);
          totalExpense += Math.abs(change);
        } else if (t.type === 'TRANSFER') {
          if (t.fromAccountId === accountId) {
            change = -parseFloat(t.amount);
            transferOut += parseFloat(t.amount);
          } else if (t.toAccountId === accountId) {
            change = parseFloat(t.amount);
            transferIn += parseFloat(t.amount);
          }
        }
        runningBalance += change;

        return {
          id: t.id,
          date: t.date.toISOString(),
          description: t.description,
          type: t.type,
          amount: parseFloat(t.amount),
          category: t.category ? { name: t.category.name } : null,
          toAccount: t.type === 'TRANSFER' && t.toAccountId !== accountId ? { name: t.toAccount?.name || '' } : null,
          runningBalance,
        };
      });

      res.status(200).send(JSON.stringify({
        account: { id: account.id, name: account.name, type: account.type, currentBalance: parseFloat(account.balance) },
        startingBalance,
        endingBalance: runningBalance,
        totalIncome,
        totalExpense,
        totalTransfer: transferIn - transferOut,
        transactions: transactionsWithBalance,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      }));
      return;
    }

    // GET net worth
    if (url === '/api/reports/net-worth' && method === 'GET') {
      const accounts = await db.account.findMany({ where: { userId: token.userId, isArchived: false } });

      const totalAssets = accounts
        .filter(a => ['BANK', 'EWALLET', 'CASH'].includes(a.type))
        .reduce((sum, a) => sum + parseFloat(a.balance), 0);

      const totalLiabilities = accounts
        .filter(a => a.type === 'CREDIT_CARD')
        .reduce((sum, a) => sum + parseFloat(a.balance), 0);

      const investments = accounts
        .filter(a => a.type === 'INVESTMENT')
        .reduce((sum, a) => sum + parseFloat(a.balance), 0);

      res.status(200).send(JSON.stringify({
        totalAssets: Math.round(totalAssets),
        totalLiabilities: Math.round(totalLiabilities),
        investments: Math.round(investments),
        netWorth: Math.round(totalAssets - totalLiabilities),
      }));
      return;
    }

    // GET general reports
    if (url === '/api/reports' && method === 'GET') {
      const transactions = await db.transaction.findMany({ where: { userId: token.userId } });
      const income = transactions.filter(t => t.type === 'INCOME').reduce((sum, t) => sum + parseFloat(t.amount), 0);
      const expenses = transactions.filter(t => t.type === 'EXPENSE').reduce((sum, t) => sum + parseFloat(t.amount), 0);
      res.status(200).send(JSON.stringify({ income, expenses, savings: income - expenses, byCategory: [] }));
      return;
    }

    // GET notifications
    if (url === '/api/notifications' && method === 'GET') {
      const notifications = await db.notification.findMany({
        where: { userId: token.userId },
        orderBy: { createdAt: 'desc' },
      });
      res.status(200).send(JSON.stringify({ notifications }));
      return;
    }

    // PUT mark notification as read
    const notificationReadMatch = url.match(/^\/api\/notifications\/([a-f0-9-]+)\/read$/i);
    if (notificationReadMatch && method === 'PUT') {
      const notification = await db.notification.update({
        where: { id: notificationReadMatch[1] },
        data: { isRead: true },
      });
      res.status(200).send(JSON.stringify({ notification }));
      return;
    }

    // PUT mark all notifications as read
    if (url === '/api/notifications/read-all' && method === 'PUT') {
      await db.notification.updateMany({
        where: { userId: token.userId },
        data: { isRead: true },
      });
      res.status(200).send(JSON.stringify({ message: 'All marked as read' }));
      return;
    }

    res.status(404).send(JSON.stringify({ error: 'Not found', url, method }));
  } catch (err) {
    console.error('Reports handler error:', err);
    res.status(500).send(JSON.stringify({ message: 'Internal server error', error: String(err) }));
  } finally {
    if (db) {
      try { await db.$disconnect(); } catch {}
    }
  }
}