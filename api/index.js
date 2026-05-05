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
let prismaInitError = null;

async function getPrisma() {
  if (prismaInitError) throw prismaInitError;
  if (prisma) return prisma;
  try {
    const { PrismaClient } = await import('@prisma/client');
    prisma = new PrismaClient();
    return prisma;
  } catch (e) {
    prismaInitError = e;
    console.error('Prisma init error:', e);
    throw e;
  }
}

function getBody(req) {
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return req.body || {};
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
  const body = getBody(req);

  try {
    const db = await getPrisma();

    // Health check
    if (url === '/api/health' && method === 'GET') {
      await db.$connect();
      res.status(200).send(JSON.stringify({ status: 'ok', database: 'connected' }));
      return;
    }

    // Auth endpoints (no token needed)
    if (url === '/api/auth/login' && method === 'POST') {
      const { email, password } = body;
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

    if (url === '/api/auth/register' && method === 'POST') {
      const { email, password, name } = body;
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

    if (url === '/api/auth/me' && method === 'GET') {
      if (!token) { res.status(401).send(JSON.stringify({ message: 'Unauthorized' })); return; }
      const user = await db.user.findUnique({ where: { id: token.userId } });
      if (!user) { res.status(404).send(JSON.stringify({ message: 'User not found' })); return; }
      res.status(200).send(JSON.stringify({ id: user.id, email: user.email, name: user.name }));
      return;
    }

    if (url === '/api/auth/change-password' && method === 'PUT') {
      if (!token) { res.status(401).send(JSON.stringify({ message: 'Unauthorized' })); return; }
      const { currentPassword, newPassword } = body;
      if (!currentPassword || !newPassword) {
        res.status(400).send(JSON.stringify({ message: 'currentPassword and newPassword required' }));
        return;
      }
      const user = await db.user.findUnique({ where: { id: token.userId } });
      if (!user) { res.status(404).send(JSON.stringify({ message: 'User not found' })); return; }
      const bcrypt = await import('bcryptjs');
      const valid = await bcrypt.compare(currentPassword, user.password);
      if (!valid) { res.status(401).send(JSON.stringify({ message: 'Current password is incorrect' })); return; }
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await db.user.update({ where: { id: token.userId }, data: { password: hashedPassword } });
      res.status(200).send(JSON.stringify({ message: 'Password updated successfully' }));
      return;
    }

    // All other endpoints require auth
    if (!token) {
      res.status(401).send(JSON.stringify({ message: 'Unauthorized' }));
      return;
    }

    // User endpoints
    if (url === '/api/user' && method === 'GET') {
      const user = await db.user.findUnique({ where: { id: token.userId } });
      if (!user) { res.status(404).send(JSON.stringify({ message: 'User not found' })); return; }
      res.status(200).send(JSON.stringify({ id: user.id, email: user.email, name: user.name }));
      return;
    }
    if (url === '/api/user/me' && method === 'GET') {
      const user = await db.user.findUnique({ where: { id: token.userId } });
      if (!user) { res.status(404).send(JSON.stringify({ message: 'User not found' })); return; }
      res.status(200).send(JSON.stringify({ id: user.id, email: user.email, name: user.name }));
      return;
    }
    if (url === '/api/user/me' && method === 'PUT') {
      const { name } = body;
      const user = await db.user.update({ where: { id: token.userId }, data: { name: name || undefined } });
      res.status(200).send(JSON.stringify({ id: user.id, email: user.email, name: user.name }));
      return;
    }
    if (url === '/api/user/preferences/notifications' && method === 'GET') {
      res.status(200).send(JSON.stringify({ email: true, push: true }));
      return;
    }
    if (url === '/api/user/preferences/notifications' && method === 'PUT') {
      res.status(200).send(JSON.stringify({ message: 'Preferences updated' }));
      return;
    }

    // Account endpoints
    if (url === '/api/accounts' && method === 'GET') {
      const accounts = await db.account.findMany({ where: { userId: token.userId } });
      res.status(200).send(JSON.stringify({ accounts }));
      return;
    }
    if (url === '/api/accounts' && method === 'POST') {
      const { name, type, balance, currency, icon, color } = body;
      if (!name || !type) { res.status(400).send(JSON.stringify({ message: 'Name and type required' })); return; }
      const account = await db.account.create({
        data: { userId: token.userId, name, type, balance: balance || 0, currency: currency || 'IDR', icon: icon || 'wallet', color: color || '#0EA5E9' }
      });
      res.status(201).send(JSON.stringify(account));
      return;
    }
    if (url.match(/^\/api\/accounts\/[^/]+$/) && method === 'GET') {
      const id = url.split('/')[3];
      const account = await db.account.findFirst({ where: { id, userId: token.userId } });
      if (!account) { res.status(404).send(JSON.stringify({ message: 'Account not found' })); return; }
      res.status(200).send(JSON.stringify(account));
      return;
    }
    if (url.match(/^\/api\/accounts\/[^/]+$/) && method === 'PUT') {
      const id = url.split('/')[3];
      const account = await db.account.findFirst({ where: { id, userId: token.userId } });
      if (!account) { res.status(404).send(JSON.stringify({ message: 'Account not found' })); return; }
      const updated = await db.account.update({ where: { id }, data: body });
      res.status(200).send(JSON.stringify(updated));
      return;
    }
    if (url.match(/^\/api\/accounts\/[^/]+$/) && method === 'DELETE') {
      const id = url.split('/')[3];
      await db.account.deleteMany({ where: { id, userId: token.userId } });
      res.status(204).send('');
      return;
    }
    if (url === '/api/accounts/balance/total' && method === 'GET') {
      const accounts = await db.account.findMany({ where: { userId: token.userId } });
      const total = accounts.reduce((sum, a) => sum + a.balance, 0);
      res.status(200).send(JSON.stringify({ total }));
      return;
    }

    // Category endpoints
    if (url === '/api/categories' && method === 'GET') {
      const categories = await db.category.findMany({ where: { userId: token.userId } });
      res.status(200).send(JSON.stringify({ categories }));
      return;
    }
    if (url === '/api/categories' && method === 'POST') {
      const { name, type, icon, color } = body;
      if (!name || !type) { res.status(400).send(JSON.stringify({ message: 'Name and type required' })); return; }
      const category = await db.category.create({
        data: { userId: token.userId, name, type, icon: icon || 'tag', color: color || '#8B5CF6' }
      });
      res.status(201).send(JSON.stringify(category));
      return;
    }
    if (url.match(/^\/api\/categories\/[^/]+$/) && method === 'GET') {
      const id = url.split('/')[3];
      const category = await db.category.findFirst({ where: { id, userId: token.userId } });
      if (!category) { res.status(404).send(JSON.stringify({ message: 'Category not found' })); return; }
      res.status(200).send(JSON.stringify(category));
      return;
    }
    if (url.match(/^\/api\/categories\/[^/]+$/) && method === 'PUT') {
      const id = url.split('/')[3];
      const category = await db.category.findFirst({ where: { id, userId: token.userId } });
      if (!category) { res.status(404).send(JSON.stringify({ message: 'Category not found' })); return; }
      const updated = await db.category.update({ where: { id }, data: body });
      res.status(200).send(JSON.stringify(updated));
      return;
    }
    if (url.match(/^\/api\/categories\/[^/]+$/) && method === 'DELETE') {
      const id = url.split('/')[3];
      await db.category.deleteMany({ where: { id, userId: token.userId } });
      res.status(204).send('');
      return;
    }

    // Transaction endpoints
    if (url === '/api/transactions' && method === 'GET') {
      const transactions = await db.transaction.findMany({
        where: { userId: token.userId },
        include: { account: true, category: true },
        orderBy: { date: 'desc' }
      });
      res.status(200).send(JSON.stringify({ transactions }));
      return;
    }
    if (url === '/api/transactions' && method === 'POST') {
      const { accountId, categoryId, type, amount, description, date } = body;
      if (!accountId || !type || amount === undefined || !description) {
        res.status(400).send(JSON.stringify({ message: 'accountId, type, amount, description required' }));
        return;
      }
      const transaction = await db.transaction.create({
        data: { userId: token.userId, accountId, categoryId: categoryId || null, type, amount, description, date: date ? new Date(date) : new Date() }
      });
      res.status(201).send(JSON.stringify(transaction));
      return;
    }
    if (url === '/api/transactions/recent' && method === 'GET') {
      const transactions = await db.transaction.findMany({
        where: { userId: token.userId },
        include: { account: true, category: true },
        orderBy: { date: 'desc' },
        take: 5
      });
      res.status(200).send(JSON.stringify({ transactions }));
      return;
    }
    if (url === '/api/transactions/summary' && method === 'GET') {
      const transactions = await db.transaction.findMany({ where: { userId: token.userId } });
      const income = transactions.filter(t => t.type === 'INCOME').reduce((sum, t) => sum + t.amount, 0);
      const expense = transactions.filter(t => t.type === 'EXPENSE').reduce((sum, t) => sum + Math.abs(t.amount), 0);
      res.status(200).send(JSON.stringify({ income, expense, balance: income - expense }));
      return;
    }
    if (url.match(/^\/api\/transactions\/[^/]+$/) && method === 'GET') {
      const id = url.split('/')[3];
      const transaction = await db.transaction.findFirst({ where: { id, userId: token.userId } });
      if (!transaction) { res.status(404).send(JSON.stringify({ message: 'Transaction not found' })); return; }
      res.status(200).send(JSON.stringify(transaction));
      return;
    }
    if (url.match(/^\/api\/transactions\/[^/]+$/) && method === 'PUT') {
      const id = url.split('/')[3];
      const updated = await db.transaction.update({ where: { id }, data: body });
      res.status(200).send(JSON.stringify(updated));
      return;
    }
    if (url.match(/^\/api\/transactions\/[^/]+$/) && method === 'DELETE') {
      const id = url.split('/')[3];
      await db.transaction.deleteMany({ where: { id, userId: token.userId } });
      res.status(204).send('');
      return;
    }

    // Budget endpoints
    if (url === '/api/budgets' && method === 'GET') {
      const budgets = await db.budget.findMany({ where: { userId: token.userId }, include: { category: true } });
      res.status(200).send(JSON.stringify({ budgets }));
      return;
    }
    if (url === '/api/budgets' && method === 'POST') {
      const { categoryId, amount, period, startDate, endDate } = body;
      if (!categoryId || !amount) { res.status(400).send(JSON.stringify({ message: 'categoryId and amount required' })); return; }
      const budget = await db.budget.create({
        data: { userId: token.userId, categoryId, amount, spent: 0, period: period || 'monthly', startDate: startDate ? new Date(startDate) : new Date(), endDate: endDate ? new Date(endDate) : new Date(Date.now() + 30*24*60*60*1000) }
      });
      res.status(201).send(JSON.stringify(budget));
      return;
    }
    if (url === '/api/budgets/summary' && method === 'GET') {
      const budgets = await db.budget.findMany({ where: { userId: token.userId } });
      const totalBudget = budgets.reduce((sum, b) => sum + b.amount, 0);
      const totalSpent = budgets.reduce((sum, b) => sum + b.spent, 0);
      res.status(200).send(JSON.stringify({ totalBudget, totalSpent, remaining: totalBudget - totalSpent }));
      return;
    }
    if (url.match(/^\/api\/budgets\/[^/]+$/) && method === 'GET') {
      const id = url.split('/')[3];
      const budget = await db.budget.findFirst({ where: { id, userId: token.userId }, include: { category: true } });
      if (!budget) { res.status(404).send(JSON.stringify({ message: 'Budget not found' })); return; }
      res.status(200).send(JSON.stringify(budget));
      return;
    }
    if (url.match(/^\/api\/budgets\/[^/]+$/) && method === 'PUT') {
      const id = url.split('/')[3];
      const updated = await db.budget.update({ where: { id }, data: body });
      res.status(200).send(JSON.stringify(updated));
      return;
    }
    if (url.match(/^\/api\/budgets\/[^/]+\/spent$/) && method === 'PUT') {
      const id = url.split('/')[3];
      const { spent } = body;
      const updated = await db.budget.update({ where: { id }, data: { spent: spent || 0 } });
      res.status(200).send(JSON.stringify(updated));
      return;
    }
    if (url.match(/^\/api\/budgets\/[^/]+$/) && method === 'DELETE') {
      const id = url.split('/')[3];
      await db.budget.deleteMany({ where: { id, userId: token.userId } });
      res.status(204).send('');
      return;
    }

    // Goal endpoints
    if (url === '/api/goals' && method === 'GET') {
      const goals = await db.goal.findMany({ where: { userId: token.userId } });
      res.status(200).send(JSON.stringify({ goals }));
      return;
    }
    if (url === '/api/goals' && method === 'POST') {
      const { name, targetAmount, deadline, icon, color } = body;
      if (!name || !targetAmount || !deadline) { res.status(400).send(JSON.stringify({ message: 'name, targetAmount, deadline required' })); return; }
      const goal = await db.goal.create({
        data: { userId: token.userId, name, targetAmount, currentAmount: 0, deadline: new Date(deadline), icon: icon || 'target', color: color || '#10B981' }
      });
      res.status(201).send(JSON.stringify(goal));
      return;
    }
    if (url === '/api/goals/overview' && method === 'GET') {
      const goals = await db.goal.findMany({ where: { userId: token.userId } });
      const totalTarget = goals.reduce((sum, g) => sum + g.targetAmount, 0);
      const totalSaved = goals.reduce((sum, g) => sum + g.currentAmount, 0);
      res.status(200).send(JSON.stringify({ totalTarget, totalSaved, progress: totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0 }));
      return;
    }
    if (url.match(/^\/api\/goals\/[^/]+$/) && method === 'GET') {
      const id = url.split('/')[3];
      const goal = await db.goal.findFirst({ where: { id, userId: token.userId } });
      if (!goal) { res.status(404).send(JSON.stringify({ message: 'Goal not found' })); return; }
      res.status(200).send(JSON.stringify(goal));
      return;
    }
    if (url.match(/^\/api\/goals\/[^/]+$/) && method === 'PUT') {
      const id = url.split('/')[3];
      const updated = await db.goal.update({ where: { id }, data: body });
      res.status(200).send(JSON.stringify(updated));
      return;
    }
    if (url.match(/^\/api\/goals\/[^/]+$/) && method === 'DELETE') {
      const id = url.split('/')[3];
      await db.goal.deleteMany({ where: { id, userId: token.userId } });
      res.status(204).send('');
      return;
    }
    if (url.match(/^\/api\/goals\/[^/]+\/contributions$/) && method === 'GET') {
      const id = url.split('/')[3];
      const contributions = await db.goalContribution.findMany({ where: { goalId: id } });
      res.status(200).send(JSON.stringify({ contributions }));
      return;
    }
    if (url.match(/^\/api\/goals\/[^/]+\/contributions$/) && method === 'POST') {
      const id = url.split('/')[3];
      const { amount, date, note } = body;
      if (!amount || !date) { res.status(400).send(JSON.stringify({ message: 'amount and date required' })); return; }
      await db.goalContribution.create({ data: { goalId: id, userId: token.userId, amount, date: new Date(date), note: note || null } });
      const goal = await db.goal.update({ where: { id }, data: { currentAmount: { increment: amount } } });
      res.status(201).send(JSON.stringify(goal));
      return;
    }
    if (url.match(/^\/api\/goals\/[^/]+\/contributions\/with-account$/) && method === 'POST') {
      const id = url.split('/')[3];
      const { amount, date, note, accountId } = body;
      if (!amount || !date) { res.status(400).send(JSON.stringify({ message: 'amount and date required' })); return; }
      await db.goalContribution.create({ data: { goalId: id, userId: token.userId, amount, date: new Date(date), note: note || null } });
      const goal = await db.goal.update({ where: { id }, data: { currentAmount: { increment: amount } } });
      res.status(201).send(JSON.stringify(goal));
      return;
    }
    if (url.match(/^\/api\/goals\/[^/]+\/lock$/) && method === 'PATCH') {
      const id = url.split('/')[3];
      const goal = await db.goal.findFirst({ where: { id, userId: token.userId } });
      if (!goal) { res.status(404).send(JSON.stringify({ message: 'Goal not found' })); return; }
      const updated = await db.goal.update({ where: { id }, data: { locked: !goal.locked } });
      res.status(200).send(JSON.stringify(updated));
      return;
    }
    if (url.match(/^\/api\/goals\/from-milestone\/[^/]+$/) && method === 'POST') {
      const milestoneId = url.split('/')[4];
      const plan = await db.plan.findFirst({ where: { userId: token.userId }, include: { milestones: true } });
      if (!plan) { res.status(404).send(JSON.stringify({ message: 'Plan not found' })); return; }
      const milestone = plan.milestones.find(m => m.id === milestoneId);
      if (!milestone) { res.status(404).send(JSON.stringify({ message: 'Milestone not found' })); return; }
      const goal = await db.goal.create({
        data: { userId: token.userId, name: milestone.title, targetAmount: milestone.targetAmount || 0, currentAmount: 0, deadline: milestone.targetDate, icon: 'target', color: '#10B981' }
      });
      res.status(201).send(JSON.stringify(goal));
      return;
    }
    if (url.match(/^\/api\/goals\/[^/]+\/with-transaction$/) && method === 'DELETE') {
      const id = url.split('/')[3];
      const { accountId } = body;
      const goal = await db.goal.findFirst({ where: { id, userId: token.userId } });
      if (!goal) { res.status(404).send(JSON.stringify({ message: 'Goal not found' })); return; }
      if (accountId) {
        const account = await db.account.findFirst({ where: { id: accountId, userId: token.userId } });
        if (account) await db.account.update({ where: { id: accountId }, data: { balance: account.balance + goal.currentAmount } });
      }
      await db.goal.deleteMany({ where: { id, userId: token.userId } });
      res.status(200).send(JSON.stringify({ message: 'Goal deleted' }));
      return;
    }
    if (url.match(/^\/api\/goals\/[^/]+\/with-refund$/) && method === 'DELETE') {
      const id = url.split('/')[3];
      await db.goal.deleteMany({ where: { id, userId: token.userId } });
      res.status(200).send(JSON.stringify({ message: 'Goal deleted' }));
      return;
    }

    // Plan endpoints
    if (url === '/api/plans' && method === 'GET') {
      const plans = await db.plan.findMany({ where: { userId: token.userId }, include: { milestones: true } });
      res.status(200).send(JSON.stringify({ plans }));
      return;
    }
    if (url === '/api/plans' && method === 'POST') {
      const { name, description, status } = body;
      if (!name) { res.status(400).send(JSON.stringify({ message: 'name required' })); return; }
      const plan = await db.plan.create({ data: { userId: token.userId, name, description: description || '', status: status || 'ACTIVE' } });
      res.status(201).send(JSON.stringify(plan));
      return;
    }
    if (url.match(/^\/api\/plans\/[^/]+$/) && method === 'GET') {
      const id = url.split('/')[3];
      const plan = await db.plan.findFirst({ where: { id, userId: token.userId }, include: { milestones: true } });
      if (!plan) { res.status(404).send(JSON.stringify({ message: 'Plan not found' })); return; }
      res.status(200).send(JSON.stringify(plan));
      return;
    }
    if (url.match(/^\/api\/plans\/[^/]+$/) && method === 'PUT') {
      const id = url.split('/')[3];
      const updated = await db.plan.update({ where: { id }, data: body });
      res.status(200).send(JSON.stringify(updated));
      return;
    }
    if (url.match(/^\/api\/plans\/[^/]+$/) && method === 'DELETE') {
      const id = url.split('/')[3];
      await db.plan.deleteMany({ where: { id, userId: token.userId } });
      res.status(204).send('');
      return;
    }
    if (url.match(/^\/api\/plans\/[^/]+\/milestones$/) && method === 'POST') {
      const planId = url.split('/')[3];
      const { title, description, targetDate, targetAmount } = body;
      if (!title || !targetDate) { res.status(400).send(JSON.stringify({ message: 'title and targetDate required' })); return; }
      const plan = await db.plan.findFirst({ where: { id: planId, userId: token.userId } });
      if (!plan) { res.status(404).send(JSON.stringify({ message: 'Plan not found' })); return; }
      const count = await db.milestone.count({ where: { planId } });
      const milestone = await db.milestone.create({ data: { planId, title, description: description || '', targetDate: new Date(targetDate), targetAmount: targetAmount || 0, order: count } });
      res.status(201).send(JSON.stringify(milestone));
      return;
    }
    if (url.match(/^\/api\/plans\/[^/]+\/milestones\/[^/]+$/) && method === 'PUT') {
      const planId = url.split('/')[3];
      const milestoneId = url.split('/')[5];
      await db.plan.findFirst({ where: { id: planId, userId: token.userId } });
      const updated = await db.milestone.update({ where: { id: milestoneId }, data: body });
      res.status(200).send(JSON.stringify(updated));
      return;
    }
    if (url.match(/^\/api\/plans\/[^/]+\/milestones\/[^/]+\/complete$/) && method === 'PATCH') {
      const planId = url.split('/')[3];
      const milestoneId = url.split('/')[5];
      await db.plan.findFirst({ where: { id: planId, userId: token.userId } });
      const updated = await db.milestone.update({ where: { id: milestoneId }, data: { isCompleted: true, completedAt: new Date() } });
      res.status(200).send(JSON.stringify(updated));
      return;
    }
    if (url.match(/^\/api\/plans\/[^/]+\/milestones\/reorder$/) && method === 'PUT') {
      const planId = url.split('/')[3];
      const { milestones } = body;
      await db.plan.findFirst({ where: { id: planId, userId: token.userId } });
      for (const m of (milestones || [])) {
        await db.milestone.update({ where: { id: m.id }, data: { order: m.order } });
      }
      res.status(200).send(JSON.stringify({ success: true }));
      return;
    }
    if (url.match(/^\/api\/plans\/[^/]+\/link-budget$/) && method === 'POST') {
      const planId = url.split('/')[3];
      const { budgetId } = body;
      const plan = await db.plan.findFirst({ where: { id: planId, userId: token.userId } });
      if (!plan) { res.status(404).send(JSON.stringify({ message: 'Plan not found' })); return; }
      res.status(200).send(JSON.stringify({ linkedBudgets: plan.linkedBudgets || [] }));
      return;
    }
    if (url.match(/^\/api\/plans\/[^/]+\/link-budget\/[^/]+$/) && method === 'DELETE') {
      const planId = url.split('/')[3];
      const budgetId = url.split('/')[5];
      await db.plan.findFirst({ where: { id: planId, userId: token.userId } });
      res.status(200).send(JSON.stringify({ success: true }));
      return;
    }
    if (url.match(/^\/api\/plans\/[^/]+\/link-goal$/) && method === 'POST') {
      const planId = url.split('/')[3];
      const { goalId } = body;
      const plan = await db.plan.findFirst({ where: { id: planId, userId: token.userId } });
      if (!plan) { res.status(404).send(JSON.stringify({ message: 'Plan not found' })); return; }
      res.status(200).send(JSON.stringify({ linkedGoals: plan.linkedGoals || [] }));
      return;
    }
    if (url.match(/^\/api\/plans\/[^/]+\/link-goal\/[^/]+$/) && method === 'DELETE') {
      const planId = url.split('/')[3];
      const goalId = url.split('/')[5];
      await db.plan.findFirst({ where: { id: planId, userId: token.userId } });
      res.status(200).send(JSON.stringify({ success: true }));
      return;
    }
    if (url.match(/^\/api\/plans\/[^/]+\/create-budgets-from-milestones$/) && method === 'POST') {
      const planId = url.split('/')[3];
      const plan = await db.plan.findFirst({ where: { id: planId, userId: token.userId }, include: { milestones: true } });
      if (!plan || !plan.milestones.length) { res.status(400).send(JSON.stringify({ message: 'No milestones found' })); return; }
      const created = [];
      for (const m of plan.milestones) {
        if (m.targetAmount > 0) {
          const budget = await db.budget.create({ data: { userId: token.userId, categoryId: '1', amount: m.targetAmount, spent: 0, period: 'monthly', startDate: m.targetDate, endDate: m.targetDate } });
          created.push(budget);
        }
      }
      res.status(201).send(JSON.stringify({ message: 'Budgets created', budgets: created }));
      return;
    }

    // Notification endpoints
    if (url === '/api/notifications' && method === 'GET') {
      const notifications = await db.notification.findMany({ where: { userId: token.userId }, orderBy: { createdAt: 'desc' } });
      res.status(200).send(JSON.stringify({ notifications }));
      return;
    }
    if (url.match(/^\/api\/notifications\/[^/]+\/read$/) && method === 'PUT') {
      const id = url.split('/')[3];
      const updated = await db.notification.update({ where: { id, userId: token.userId }, data: { isRead: true } });
      res.status(200).send(JSON.stringify(updated));
      return;
    }
    if (url === '/api/notifications/read-all' && method === 'PUT') {
      await db.notification.updateMany({ where: { userId: token.userId, isRead: false }, data: { isRead: true } });
      res.status(200).send(JSON.stringify({ success: true }));
      return;
    }

    // Report endpoints
    if (url === '/api/reports' && method === 'GET') {
      const transactions = await db.transaction.findMany({ where: { userId: token.userId } });
      const income = transactions.filter(t => t.type === 'INCOME').reduce((sum, t) => sum + t.amount, 0);
      const expenses = transactions.filter(t => t.type === 'EXPENSE').reduce((sum, t) => sum + Math.abs(t.amount), 0);
      res.status(200).send(JSON.stringify({ income, expenses, savings: income - expenses, byCategory: [] }));
      return;
    }
    if (url.match(/^\/api\/reports\/monthly/) && method === 'GET') {
      const transactions = await db.transaction.findMany({ where: { userId: token.userId } });
      const income = transactions.filter(t => t.type === 'INCOME').reduce((sum, t) => sum + t.amount, 0);
      const expenses = transactions.filter(t => t.type === 'EXPENSE').reduce((sum, t) => sum + Math.abs(t.amount, 0));
      res.status(200).send(JSON.stringify({ report: { summary: { totalIncome: income, totalExpense: expenses, balance: income - expenses } }));
      return;
    }
    if (url.match(/^\/api\/reports\/trends/) && method === 'GET') {
      res.status(200).send(JSON.stringify({ trends: [] }));
      return;
    }
    if (url.match(/^\/api\/reports\/category-breakdown/) && method === 'GET') {
      res.status(200).send(JSON.stringify({ total: 0, categories: [] }));
      return;
    }
    if (url === '/api/reports/net-worth' && method === 'GET') {
      const accounts = await db.account.findMany({ where: { userId: token.userId } });
      const totalAssets = accounts.reduce((sum, a) => sum + a.balance, 0);
      res.status(200).send(JSON.stringify({ totalAssets, totalLiabilities: 0, investments: 0, netWorth: totalAssets }));
      return;
    }
    if (url.match(/^\/api\/reports\/cash-flow/) && method === 'GET') {
      res.status(200).send(JSON.stringify({ dailyFlow: [] }));
      return;
    }
    if (url.match(/^\/api\/reports\/export\/transactions/) && method === 'GET') {
      const transactions = await db.transaction.findMany({ where: { userId: token.userId } });
      const csv = 'Date,Description,Amount,Type\n' + transactions.map(t => `${t.date},"${t.description}",${t.amount},${t.type}`).join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=transactions.csv');
      res.send(csv);
      return;
    }

    // AI endpoints
    if (url === '/api/ai/ask' && method === 'POST') {
      res.status(200).send(JSON.stringify({ answer: 'AI features require additional setup.' }));
      return;
    }
    if (url === '/api/ai/suggestions' && method === 'GET') {
      res.status(200).send(JSON.stringify({ suggestions: [] }));
      return;
    }
    if (url === '/api/ai/advice' && method === 'GET') {
      res.status(200).send(JSON.stringify({ advice: 'Track your expenses consistently.' }));
      return;
    }
    if (url.match(/^\/api\/ai\/analyze-spending/) && method === 'GET') {
      res.status(200).send(JSON.stringify({ analysis: { totalSpending: 0, categoryBreakdown: [] } }));
      return;
    }
    if (url === '/api/ai/generate-plan-from-data' && method === 'POST') {
      res.status(200).send(JSON.stringify({ plan: { name: 'AI Generated Plan', milestones: [] }, summary: {} }));
      return;
    }

    res.status(404).send(JSON.stringify({ error: 'Not found', url, method }));
  } catch (err) {
    console.error('Error:', err);
    const errorMessage = err instanceof Error ? err.message : String(err);
    res.status(500).send(JSON.stringify({ error: 'Internal server error', message: errorMessage, url }));
  }
}