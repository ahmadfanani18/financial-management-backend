const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'https://financial-management-frontend.vercel.app',
  'https://financial-management-frontend-seven.vercel.app'
];

function simpleToken(userId, email) {
  return Buffer.from(JSON.stringify({ userId, email })).toString('base64');
}

function parseToken(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  try {
    return JSON.parse(Buffer.from(authHeader.slice(7), 'base64').toString());
  } catch {
    return null;
  }
}

let prisma = null;

async function getPrisma() {
  if (!prisma) {
    const { PrismaClient } = await import('@prisma/client');
    const databaseUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
    prisma = new PrismaClient({
      datasources: databaseUrl ? { db: { url: databaseUrl } } : undefined
    });
  }
  return prisma;
}

function parseBody(body) {
  return typeof body === 'string' ? JSON.parse(body) : body;
}

export default async function handler(req, res) {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, POST, DELETE, PATCH, OPTIONS');
  }

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  res.setHeader('Content-Type', 'application/json');

  const url = (req.url || '/').split('?')[0];
  const method = req.method;
  const token = parseToken(req.headers.authorization);

  try {
    const db = await getPrisma();

    // Health check
    if (url === '/api/health' && method === 'GET') {
      await db.$connect();
      res.status(200).send(JSON.stringify({ status: 'ok', database: 'connected' }));
      return;
    }

    // Auth - Login
    if (url === '/api/auth/login' && method === 'POST') {
      const body = parseBody(req.body);
      const { email, password } = body || {};
      if (!email || !password) {
        res.status(400).send(JSON.stringify({ message: 'Email and password required' }));
        return;
      }
      const user = await db.user.findUnique({ where: { email } });
      if (!user) {
        res.status(401).send(JSON.stringify({ message: 'Invalid credentials' }));
        return;
      }
      const authToken = simpleToken(user.id, user.email);
      res.status(200).send(JSON.stringify({ token: authToken, user: { id: user.id, email: user.email, name: user.name } }));
      return;
    }

    // Auth - Register
    if (url === '/api/auth/register' && method === 'POST') {
      const body = parseBody(req.body);
      const { email, password, name } = body || {};
      if (!email || !password) {
        res.status(400).send(JSON.stringify({ message: 'Email and password required' }));
        return;
      }
      const existing = await db.user.findUnique({ where: { email } });
      if (existing) {
        res.status(400).send(JSON.stringify({ message: 'Email already exists' }));
        return;
      }
      const bcrypt = await import('bcryptjs');
      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await db.user.create({
        data: { email, password: hashedPassword, name: name || email.split('@')[0] }
      });
      const authToken = simpleToken(user.id, user.email);
      res.status(201).send(JSON.stringify({ token: authToken, user: { id: user.id, email: user.email, name: user.name } }));
      return;
    }

    // Auth - Me
    if (url === '/api/auth/me' && method === 'GET') {
      if (!token) {
        res.status(401).send(JSON.stringify({ message: 'Unauthorized' }));
        return;
      }
      const user = await db.user.findUnique({ where: { id: token.userId } });
      if (!user) {
        res.status(404).send(JSON.stringify({ message: 'User not found' }));
        return;
      }
      res.status(200).send(JSON.stringify({ id: user.id, email: user.email, name: user.name }));
      return;
    }

    if (!token) {
      res.status(401).send(JSON.stringify({ message: 'Unauthorized' }));
      return;
    }

    // ==================== USER ====================
    if (url === '/api/user/me' && method === 'GET') {
      const user = await db.user.findUnique({ where: { id: token.userId } });
      if (!user) {
        res.status(404).send(JSON.stringify({ message: 'User not found' }));
        return;
      }
      res.status(200).send(JSON.stringify({ user: { id: user.id, email: user.email, name: user.name } }));
      return;
    }

    if (url === '/api/user/me' && method === 'PUT') {
      const body = parseBody(req.body);
      const user = await db.user.update({
        where: { id: token.userId },
        data: { name: body.name }
      });
      res.status(200).send(JSON.stringify({ user: { id: user.id, email: user.email, name: user.name } }));
      return;
    }

    // ==================== ACCOUNTS ====================
    // GET all accounts
    if (url === '/api/accounts' && method === 'GET') {
      const accounts = await db.account.findMany({ where: { userId: token.userId } });
      res.status(200).send(JSON.stringify({ accounts }));
      return;
    }

    // POST create account
    if (url === '/api/accounts' && method === 'POST') {
      const body = parseBody(req.body);
      const account = await db.account.create({
        data: {
          userId: token.userId,
          name: body.name,
          type: body.type || 'BANK',
          balance: body.balance || 0,
          currency: body.currency || 'IDR',
          icon: body.icon || 'wallet',
          color: body.color || '#3B82F6',
          isArchived: false
        }
      });
      res.status(201).send(JSON.stringify({ account }));
      return;
    }

    // GET account by ID
    const accountMatch = url.match(/^\/api\/accounts\/([a-f0-9-]+)$/i);
    if (accountMatch && method === 'GET') {
      const account = await db.account.findFirst({ where: { id: accountMatch[1], userId: token.userId } });
      if (!account) {
        res.status(404).send(JSON.stringify({ message: 'Account not found' }));
        return;
      }
      res.status(200).send(JSON.stringify({ account }));
      return;
    }

    // PUT update account
    if (accountMatch && method === 'PUT') {
      const body = parseBody(req.body);
      const account = await db.account.update({
        where: { id: accountMatch[1] },
        data: body
      });
      res.status(200).send(JSON.stringify({ account }));
      return;
    }

    // DELETE account
    if (accountMatch && method === 'DELETE') {
      await db.account.delete({ where: { id: accountMatch[1] } });
      res.status(204).send(JSON.stringify({ message: 'Deleted' }));
      return;
    }

    // GET total balance
    if (url === '/api/accounts/balance/total' && method === 'GET') {
      const accounts = await db.account.findMany({ where: { userId: token.userId, isArchived: false } });
      const total = accounts.reduce((sum, acc) => sum + acc.balance, 0);
      res.status(200).send(JSON.stringify({ total }));
      return;
    }

    // ==================== CATEGORIES ====================
    // GET all categories
    if (url === '/api/categories' && method === 'GET') {
      const categories = await db.category.findMany({ where: { userId: token.userId } });
      res.status(200).send(JSON.stringify({ categories }));
      return;
    }

    // POST create category
    if (url === '/api/categories' && method === 'POST') {
      const body = parseBody(req.body);
      const category = await db.category.create({
        data: {
          userId: token.userId,
          name: body.name,
          type: body.type || 'EXPENSE',
          icon: body.icon || 'tag',
          color: body.color || '#3B82F6',
          isDefault: false
        }
      });
      res.status(201).send(JSON.stringify({ category }));
      return;
    }

    // GET category by ID
    const categoryMatch = url.match(/^\/api\/categories\/([a-f0-9-]+)$/i);
    if (categoryMatch && method === 'GET') {
      const category = await db.category.findFirst({ where: { id: categoryMatch[1], userId: token.userId } });
      if (!category) {
        res.status(404).send(JSON.stringify({ message: 'Category not found' }));
        return;
      }
      res.status(200).send(JSON.stringify({ category }));
      return;
    }

    // PUT update category
    if (categoryMatch && method === 'PUT') {
      const body = parseBody(req.body);
      const category = await db.category.update({
        where: { id: categoryMatch[1] },
        data: body
      });
      res.status(200).send(JSON.stringify({ category }));
      return;
    }

    // DELETE category
    if (categoryMatch && method === 'DELETE') {
      await db.category.delete({ where: { id: categoryMatch[1] } });
      res.status(204).send(JSON.stringify({ message: 'Deleted' }));
      return;
    }

    // ==================== TRANSACTIONS ====================
    // GET all transactions
    if (url === '/api/transactions' && method === 'GET') {
      const transactions = await db.transaction.findMany({
        where: { userId: token.userId },
        include: { account: true, category: true },
        orderBy: { date: 'desc' }
      });
      res.status(200).send(JSON.stringify({ transactions, total: transactions.length, page: 1, totalPages: 1 }));
      return;
    }

    // POST create transaction
    if (url === '/api/transactions' && method === 'POST') {
      const body = parseBody(req.body);
      const transaction = await db.transaction.create({
        data: {
          userId: token.userId,
          accountId: body.accountId,
          categoryId: body.categoryId || null,
          type: body.type || 'EXPENSE',
          amount: body.amount,
          description: body.description || '',
          date: body.date ? new Date(body.date).toISOString() : new Date().toISOString(),
          fromAccountId: body.fromAccountId || null,
          toAccountId: body.toAccountId || null,
          isRecurring: body.isRecurring || false
        },
        include: { account: true, category: true }
      });
      res.status(201).send(JSON.stringify({ transaction }));
      return;
    }

    // GET transaction by ID
    const transactionMatch = url.match(/^\/api\/transactions\/([a-f0-9-]+)$/i);
    if (transactionMatch && method === 'GET') {
      const transaction = await db.transaction.findFirst({ where: { id: transactionMatch[1], userId: token.userId } });
      if (!transaction) {
        res.status(404).send(JSON.stringify({ message: 'Transaction not found' }));
        return;
      }
      res.status(200).send(JSON.stringify({ transaction }));
      return;
    }

    // PUT update transaction
    if (transactionMatch && method === 'PUT') {
      const body = parseBody(req.body);
      const updateData = { ...body };
      if (body.date) updateData.date = new Date(body.date).toISOString();
      if (body.fromAccountId === '') updateData.fromAccountId = null;
      if (body.toAccountId === '') updateData.toAccountId = null;
      if (body.categoryId === '') updateData.categoryId = null;
      const transaction = await db.transaction.update({
        where: { id: transactionMatch[1] },
        data: updateData
      });
      res.status(200).send(JSON.stringify({ transaction }));
      return;
    }

    // DELETE transaction
    if (transactionMatch && method === 'DELETE') {
      await db.transaction.delete({ where: { id: transactionMatch[1] } });
      res.status(204).send(JSON.stringify({ message: 'Deleted' }));
      return;
    }

    // GET recent transactions
    if (url === '/api/transactions/recent' && method === 'GET') {
      const limit = parseInt(new URL(req.url, 'http://localhost').searchParams.get('limit') || '5');
      const transactions = await db.transaction.findMany({
        where: { userId: token.userId },
        include: { account: true, category: true },
        orderBy: { date: 'desc' },
        take: limit
      });
      res.status(200).send(JSON.stringify({ transactions }));
      return;
    }

    // GET transactions summary
    if (url === '/api/transactions/summary' && method === 'GET') {
      const params = new URL(req.url, 'http://localhost').searchParams;
      const startDate = params.get('startDate');
      const endDate = params.get('endDate');
      const where = { userId: token.userId };
      if (startDate || endDate) {
        where.date = {};
        if (startDate) where.date.gte = new Date(startDate).toISOString();
        if (endDate) where.date.lte = new Date(endDate).toISOString();
      }
      const transactions = await db.transaction.findMany({ where });
      const income = transactions.filter(t => t.type === 'INCOME').reduce((sum, t) => sum + t.amount, 0);
      const expense = transactions.filter(t => t.type === 'EXPENSE').reduce((sum, t) => sum + Math.abs(t.amount), 0);
      res.status(200).send(JSON.stringify({ income, expense, balance: income - expense }));
      return;
    }

    // ==================== BUDGETS ====================
    // GET all budgets
    if (url === '/api/budgets' && method === 'GET') {
      const budgets = await db.budget.findMany({ where: { userId: token.userId }, include: { category: true } });
      const allExpenses = await db.transaction.groupBy({
        by: ['categoryId'],
        where: { userId: token.userId, type: 'EXPENSE' },
        _sum: { amount: true }
      });
      const expenseByCategory = Object.fromEntries(allExpenses.map(e => [e.categoryId, Math.abs(e._sum.amount || 0)]));
      const budgetsWithSpent = budgets.map(b => {
        const spent = expenseByCategory[b.categoryId] || 0;
        return { ...b, spent, remaining: b.amount - spent, percentage: b.amount > 0 ? Math.round((spent / b.amount) * 100) : 0 };
      });
      res.status(200).send(JSON.stringify({ budgets: budgetsWithSpent }));
      return;
    }

    // POST create budget
    if (url === '/api/budgets' && method === 'POST') {
      const body = parseBody(req.body);
      const budget = await db.budget.create({
        data: {
          userId: token.userId,
          categoryId: body.categoryId,
          amount: body.amount,
          period: body.period || 'MONTHLY',
          startDate: body.startDate ? new Date(body.startDate).toISOString() : new Date().toISOString(),
          endDate: body.endDate,
          warningThreshold: body.warningThreshold || 80,
          isActive: body.isActive !== false
        },
        include: { category: true }
      });
      res.status(201).send(JSON.stringify({ budget }));
      return;
    }

    // GET budgets summary
    if (url === '/api/budgets/summary' && method === 'GET') {
      const budgets = await db.budget.findMany({ where: { userId: token.userId } });
      const totalBudget = budgets.reduce((sum, b) => sum + Number(b.amount), 0);
      const allTransactions = await db.transaction.findMany({ where: { userId: token.userId, type: 'EXPENSE' } });
      const totalSpent = allTransactions.reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);
      res.status(200).send(JSON.stringify({ totalBudget, totalSpent, remaining: totalBudget - totalSpent, budgetCount: budgets.length }));
      return;
    }

    // GET budget by ID
    const budgetMatch = url.match(/^\/api\/budgets\/([a-f0-9-]+)$/i);
    if (budgetMatch && method === 'GET') {
      const budget = await db.budget.findFirst({ where: { id: budgetMatch[1], userId: token.userId }, include: { category: true } });
      if (!budget) {
        res.status(404).send(JSON.stringify({ message: 'Budget not found' }));
        return;
      }
      res.status(200).send(JSON.stringify({ budget }));
      return;
    }

    // PUT update budget
    if (budgetMatch && method === 'PUT') {
      const body = parseBody(req.body);
      const updateData = { ...body };
      if (body.startDate) updateData.startDate = new Date(body.startDate).toISOString();
      if (body.endDate === '') updateData.endDate = null;
      else if (body.endDate) updateData.endDate = new Date(body.endDate).toISOString();
      const budget = await db.budget.update({ where: { id: budgetMatch[1] }, data: updateData });
      res.status(200).send(JSON.stringify({ budget }));
      return;
    }

    // DELETE budget
    if (budgetMatch && method === 'DELETE') {
      await db.budget.delete({ where: { id: budgetMatch[1] } });
      res.status(204).send(JSON.stringify({ message: 'Deleted' }));
      return;
    }

    // ==================== GOALS ====================
    // GET all goals
    if (url === '/api/goals' && method === 'GET') {
      const goals = await db.goal.findMany({ where: { userId: token.userId } });
      const goalsWithProgress = goals.map(g => ({
        ...g,
        percentage: g.targetAmount > 0 ? Math.round((g.currentAmount / g.targetAmount) * 100) : 0,
        daysRemaining: Math.ceil((new Date(g.deadline) - new Date()) / (1000 * 60 * 60 * 24)),
        isCompleted: g.currentAmount >= g.targetAmount,
        isOverdue: new Date(g.deadline) < new Date() && g.currentAmount < g.targetAmount
      }));
      res.status(200).send(JSON.stringify({ goals: goalsWithProgress }));
      return;
    }

    // POST create goal
    if (url === '/api/goals' && method === 'POST') {
      const body = parseBody(req.body);
      const goal = await db.goal.create({
        data: {
          userId: token.userId,
          name: body.name,
          targetAmount: body.targetAmount,
          currentAmount: body.currentAmount || 0,
          deadline: body.deadline ? new Date(body.deadline).toISOString() : new Date().toISOString(),
          icon: body.icon || 'target',
          color: body.color || '#10B981',
          status: 'ACTIVE',
          isLocked: false
        }
      });
      res.status(201).send(JSON.stringify({ goal }));
      return;
    }

    // GET goals overview
    if (url === '/api/goals/overview' && method === 'GET') {
      const goals = await db.goal.findMany({ where: { userId: token.userId } });
      const totalTarget = goals.reduce((sum, g) => sum + Number(g.targetAmount), 0);
      const totalSaved = goals.reduce((sum, g) => sum + Number(g.currentAmount), 0);
      res.status(200).send(JSON.stringify({ totalTarget, totalSaved, progress: totalTarget > 0 ? Math.round((totalSaved / totalTarget) * 100) : 0 }));
      return;
    }

    // GET goal by ID
    const goalMatch = url.match(/^\/api\/goals\/([a-f0-9-]+)$/i);
    if (goalMatch && method === 'GET') {
      const goal = await db.goal.findFirst({ where: { id: goalMatch[1], userId: token.userId } });
      if (!goal) {
        res.status(404).send(JSON.stringify({ message: 'Goal not found' }));
        return;
      }
      res.status(200).send(JSON.stringify({ goal }));
      return;
    }

    // PUT update goal
    if (goalMatch && method === 'PUT') {
      const body = parseBody(req.body);
      const updateData = { ...body };
      if (body.deadline) updateData.deadline = new Date(body.deadline).toISOString();
      const goal = await db.goal.update({ where: { id: goalMatch[1] }, data: updateData });
      res.status(200).send(JSON.stringify({ goal }));
      return;
    }

    // DELETE goal
    if (goalMatch && method === 'DELETE') {
      await db.goal.delete({ where: { id: goalMatch[1] } });
      res.status(204).send(JSON.stringify({ message: 'Deleted' }));
      return;
    }

    // GET goal contributions
    const goalContributionsMatch = url.match(/^\/api\/goals\/([a-f0-9-]+)\/contributions$/i);
    if (goalContributionsMatch && method === 'GET') {
      const goalId = goalContributionsMatch[1];
      res.status(200).send(JSON.stringify({ contributions: [] }));
      return;
    }

    // POST goal contribution
    if (goalContributionsMatch && method === 'POST') {
      const body = parseBody(req.body);
      const goalId = goalContributionsMatch[1];
      const goal = await db.goal.update({
        where: { id: goalId },
        data: { currentAmount: { increment: body.amount } }
      });
      res.status(200).send(JSON.stringify({ goal }));
      return;
    }

    // PATCH goal lock toggle
    const goalLockMatch = url.match(/^\/api\/goals\/([a-f0-9-]+)\/lock$/i);
    if (goalLockMatch && method === 'PATCH') {
      const goalId = goalLockMatch[1];
      const goal = await db.goal.findFirst({ where: { id: goalId, userId: token.userId } });
      if (!goal) {
        res.status(404).send(JSON.stringify({ message: 'Goal not found' }));
        return;
      }
      const updated = await db.goal.update({
        where: { id: goalId },
        data: { isLocked: !goal.isLocked }
      });
      res.status(200).send(JSON.stringify({ goal: updated }));
      return;
    }

    // POST goal contribution with account (creates transaction)
    const goalContribWithAccountMatch = url.match(/^\/api\/goals\/([a-f0-9-]+)\/contributions\/with-account$/i);
    if (goalContribWithAccountMatch && method === 'POST') {
      const body = parseBody(req.body);
      const goalId = goalContribWithAccountMatch[1];
      await db.goal.update({
        where: { id: goalId },
        data: { currentAmount: { increment: body.amount } }
      });
      await db.transaction.create({
        data: {
          userId: token.userId,
          accountId: body.accountId,
          categoryId: body.categoryId || null,
          type: 'EXPENSE',
          amount: body.amount,
          description: body.note || 'Goal contribution',
          date: body.date ? new Date(body.date).toISOString() : new Date().toISOString()
        }
      });
      const goal = await db.goal.findUnique({ where: { id: goalId } });
      res.status(200).send(JSON.stringify({ goal }));
      return;
    }

    // DELETE goal with transaction refund
    const goalWithTransactionMatch = url.match(/^\/api\/goals\/([a-f0-9-]+)\/with-transaction$/i);
    if (goalWithTransactionMatch && method === 'DELETE') {
      const body = parseBody(req.body);
      const goalId = goalWithTransactionMatch[1];
      const goal = await db.goal.findFirst({ where: { id: goalId, userId: token.userId } });
      if (!goal) {
        res.status(404).send(JSON.stringify({ message: 'Goal not found' }));
        return;
      }
      if (body.accountId && goal.currentAmount > 0) {
        await db.transaction.create({
          data: {
            userId: token.userId,
            accountId: body.accountId,
            type: 'INCOME',
            amount: goal.currentAmount,
            description: `Refund from goal: ${goal.name}`,
            date: new Date().toISOString()
          }
        });
      }
      await db.goal.delete({ where: { id: goalId } });
      res.status(204).send(JSON.stringify({ message: 'Deleted' }));
      return;
    }

    // DELETE goal with refund
    const goalWithRefundMatch = url.match(/^\/api\/goals\/([a-f0-9-]+)\/with-refund$/i);
    if (goalWithRefundMatch && method === 'DELETE') {
      const goalId = goalWithRefundMatch[1];
      const goal = await db.goal.findFirst({ where: { id: goalId, userId: token.userId } });
      if (!goal) {
        res.status(404).send(JSON.stringify({ message: 'Goal not found' }));
        return;
      }
      await db.goal.delete({ where: { id: goalId } });
      res.status(204).send(JSON.stringify({ message: 'Deleted' }));
      return;
    }

    // ==================== PLANS ====================
    // GET all plans
    if (url === '/api/plans' && method === 'GET') {
      const plans = await db.plan.findMany({ where: { userId: token.userId }, include: { milestones: true } });
      res.status(200).send(JSON.stringify({ plans }));
      return;
    }

    // POST create plan
    if (url === '/api/plans' && method === 'POST') {
      const body = parseBody(req.body);
      const plan = await db.plan.create({
        data: {
          userId: token.userId,
          name: body.name,
          description: body.description,
          startDate: body.startDate ? new Date(body.startDate).toISOString() : new Date().toISOString(),
          endDate: body.endDate ? new Date(body.endDate).toISOString() : null,
          status: 'ACTIVE'
        }
      });
      res.status(201).send(JSON.stringify({ plan }));
      return;
    }

    // GET plan by ID
    const planMatch = url.match(/^\/api\/plans\/([a-f0-9-]+)$/i);
    if (planMatch && method === 'GET') {
      const plan = await db.plan.findFirst({ where: { id: planMatch[1], userId: token.userId }, include: { milestones: true } });
      if (!plan) {
        res.status(404).send(JSON.stringify({ message: 'Plan not found' }));
        return;
      }
      res.status(200).send(JSON.stringify({ plan }));
      return;
    }

    // PUT update plan
    if (planMatch && method === 'PUT') {
      const body = parseBody(req.body);
      const plan = await db.plan.update({ where: { id: planMatch[1] }, data: body });
      res.status(200).send(JSON.stringify({ plan }));
      return;
    }

    // DELETE plan
    if (planMatch && method === 'DELETE') {
      await db.plan.delete({ where: { id: planMatch[1] } });
      res.status(204).send(JSON.stringify({ message: 'Deleted' }));
      return;
    }

    // ==================== NOTIFICATIONS ====================
    if (url === '/api/notifications' && method === 'GET') {
      const notifications = await db.notification.findMany({ where: { userId: token.userId }, orderBy: { createdAt: 'desc' } });
      res.status(200).send(JSON.stringify({ notifications }));
      return;
    }

    // Mark notification as read
    const notificationReadMatch = url.match(/^\/api\/notifications\/([a-f0-9-]+)\/read$/i);
    if (notificationReadMatch && method === 'PUT') {
      const notification = await db.notification.update({
        where: { id: notificationReadMatch[1] },
        data: { isRead: true }
      });
      res.status(200).send(JSON.stringify({ notification }));
      return;
    }

    // Mark all notifications as read
    if (url === '/api/notifications/read-all' && method === 'PUT') {
      await db.notification.updateMany({
        where: { userId: token.userId },
        data: { isRead: true }
      });
      res.status(200).send(JSON.stringify({ message: 'All marked as read' }));
      return;
    }

    // ==================== REPORTS ====================
    // GET general reports
    if (url === '/api/reports' && method === 'GET') {
      const transactions = await db.transaction.findMany({ where: { userId: token.userId } });
      const income = transactions.filter(t => t.type === 'INCOME').reduce((sum, t) => sum + t.amount, 0);
      const expenses = transactions.filter(t => t.type === 'EXPENSE').reduce((sum, t) => sum + Math.abs(t.amount), 0);
      res.status(200).send(JSON.stringify({ income, expenses, savings: income - expenses, byCategory: [] }));
      return;
    }

    // GET monthly report
    if (url === '/api/reports/monthly' && method === 'GET') {
      const params = new URL(req.url, 'http://localhost').searchParams;
      const year = parseInt(params.get('year') || new Date().getFullYear());
      const month = parseInt(params.get('month') || (new Date().getMonth() + 1));
      const startDate = new Date(year, month - 1, 1).toISOString();
      const endDate = new Date(year, month, 0).toISOString();
      const transactions = await db.transaction.findMany({
        where: { userId: token.userId, date: { gte: startDate, lte: endDate } }
      });
      const totalIncome = transactions.filter(t => t.type === 'INCOME').reduce((sum, t) => sum + t.amount, 0);
      const totalExpense = transactions.filter(t => t.type === 'EXPENSE').reduce((sum, t) => sum + Math.abs(t.amount), 0);
      res.status(200).send(JSON.stringify({
        report: {
          period: { year, month, label: `${month}/${year}` },
          summary: { totalIncome, totalExpense, balance: totalIncome - totalExpense },
          incomeByCategory: [],
          expenseByCategory: [],
          transactions
        }
      }));
      return;
    }

    // GET trends
    if (url === '/api/reports/trends' && method === 'GET') {
      res.status(200).send(JSON.stringify({ trends: [] }));
      return;
    }

    // GET net worth
    if (url === '/api/reports/net-worth' && method === 'GET') {
      const accounts = await db.account.findMany({ where: { userId: token.userId, isArchived: false } });
      const totalAssets = accounts.reduce((sum, a) => sum + a.balance, 0);
      res.status(200).send(JSON.stringify({ totalAssets, totalLiabilities: 0, investments: 0, netWorth: totalAssets }));
      return;
    }

    // GET cash flow
    if (url === '/api/reports/cash-flow' && method === 'GET') {
      res.status(200).send(JSON.stringify({ dailyFlow: [] }));
      return;
    }

    // GET category breakdown
    if (url === '/api/reports/category-breakdown' && method === 'GET') {
      res.status(200).send(JSON.stringify({ total: 0, categories: [] }));
      return;
    }

    // ==================== AI ENDPOINTS ====================
    // POST ai ask
    if (url === '/api/ai/ask' && method === 'POST') {
      res.status(200).send(JSON.stringify({ answer: 'Fitur AI sedang dalam pengembangan.' }));
      return;
    }

    // GET ai suggestions
    if (url === '/api/ai/suggestions' && method === 'GET') {
      res.status(200).send(JSON.stringify({ suggestions: [] }));
      return;
    }

    // GET ai advice
    if (url === '/api/ai/advice' && method === 'GET') {
      res.status(200).send(JSON.stringify({ advice: 'Pertahankan kebiasaan menabung yang baik!' }));
      return;
    }

    // GET ai analyze spending
    if (url.match(/^\/api\/ai\/analyze-spending/i) && method === 'GET') {
      res.status(200).send(JSON.stringify({ analysis: { message: 'Analisis spending belum tersedia' } }));
      return;
    }

    // POST ai generate plan
    if (url === '/api/ai/generate-plan-from-data' && method === 'POST') {
      res.status(200).send(JSON.stringify({
        plan: { name: 'Rencana Keuangan', description: 'Plan generated by AI', status: 'ACTIVE', milestones: [] },
        summary: { totalBalance: '0', monthlyIncome: '0', monthlyExpense: '0', savings: '0', topExpenses: [] }
      }));
      return;
    }

    // ==================== FALLBACK ====================
    res.status(404).send(JSON.stringify({ error: 'Not found', url, method }));
  } catch (err) {
    console.error('Error:', err);
    res.status(500).send(JSON.stringify({ error: 'Internal server error', message: String(err) }));
  }
}