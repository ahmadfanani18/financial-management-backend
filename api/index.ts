import 'dotenv/config';

let prisma: any = null;

let prismaInstance: any = null;

function getPrisma() {
  if (!prismaInstance) {
    const { PrismaClient } = require('@prisma/client');
    prismaInstance = new PrismaClient();
  }
  return prismaInstance;
}

const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'https://financial-management-frontend.vercel.app',
  'https://financial-management-frontend-seven.vercel.app'
];

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret';

function simpleToken(userId: number, email: string): string {
  return Buffer.from(JSON.stringify({ userId, email })).toString('base64');
}

function parseToken(authHeader?: string): { userId: number; email: string } | null {
  if (!authHeader?.startsWith('Bearer ')) return null;
  try {
    return JSON.parse(Buffer.from(authHeader.slice(7), 'base64').toString());
  } catch {
    return null;
  }
}

export default async function handler(req: unknown, res: unknown) {
  const vercelReq = req as { method: string; url: string; headers: Record<string, string | string[] | undefined>; body: unknown };
  const vercelRes = res as { status: (code: number) => typeof vercelRes; setHeader: (key: string, value: string) => void; send: (data: string) => void };

  try {
    const origin = vercelReq.headers.origin;
    if (ALLOWED_ORIGINS.includes(origin as string)) {
      vercelRes.setHeader('Access-Control-Allow-Origin', origin as string);
      vercelRes.setHeader('Access-Control-Allow-Credentials', 'true');
      vercelRes.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      vercelRes.setHeader('Access-Control-Allow-Methods', 'GET, PUT, POST, DELETE, PATCH, OPTIONS');
    }

    if (vercelReq.method === 'OPTIONS') {
      vercelRes.status(204).send('');
      return;
    }

    vercelRes.setHeader('Content-Type', 'application/json');

  const url = vercelReq.url?.split('?')[0] || '/';
  const method = vercelReq.method;
  const token = parseToken(vercelReq.headers.authorization as string);

  try {
    // Health check
    if (url === '/api/health' && method === 'GET') {
      await getPrisma().$connect();
      vercelRes.status(200).send(JSON.stringify({ status: 'ok', database: 'connected' }));
      return;
    }

    // Auth endpoints (no token needed)
    if (url === '/api/auth/login' && method === 'POST') {
      const { email, password } = (vercelReq.body as { email?: string; password?: string }) || {};
      if (!email || !password) {
        vercelRes.status(400).send(JSON.stringify({ message: 'Email and password required' }));
        return;
      }
      const user = await getPrisma().user.findUnique({ where: { email } });
      if (!user) {
        vercelRes.status(401).send(JSON.stringify({ message: 'Invalid credentials' }));
        return;
      }
      const token = simpleToken(user.id, user.email);
      vercelRes.status(200).send(JSON.stringify({ token, user: { id: user.id, email: user.email, name: user.name } }));
      return;
    }

    if (url === '/api/auth/register' && method === 'POST') {
      const { email, password, name } = (vercelReq.body as { email?: string; password?: string; name?: string }) || {};
      if (!email || !password) {
        vercelRes.status(400).send(JSON.stringify({ message: 'Email and password required' }));
        return;
      }
      const existing = await getPrisma().user.findUnique({ where: { email } });
      if (existing) {
        vercelRes.status(400).send(JSON.stringify({ message: 'Email already exists' }));
        return;
      }
      const bcrypt = await import('bcryptjs');
      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await getPrisma().user.create({
        data: { email, password: hashedPassword, name: name || email.split('@')[0] }
      });
      const token = simpleToken(user.id, user.email);
      vercelRes.status(201).send(JSON.stringify({ token, user: { id: user.id, email: user.email, name: user.name } }));
      return;
    }

    if (url === '/api/auth/me' && method === 'GET') {
      if (!token) {
        vercelRes.status(401).send(JSON.stringify({ message: 'Unauthorized' }));
        return;
      }
      const user = await getPrisma().user.findUnique({ where: { id: token.userId } });
      if (!user) {
        vercelRes.status(404).send(JSON.stringify({ message: 'User not found' }));
        return;
      }
      vercelRes.status(200).send(JSON.stringify({ id: user.id, email: user.email, name: user.name }));
      return;
    }

    if (url === '/api/auth/change-password' && method === 'PUT') {
      if (!token) {
        vercelRes.status(401).send(JSON.stringify({ message: 'Unauthorized' }));
        return;
      }
      const { currentPassword, newPassword } = (vercelReq.body as { currentPassword?: string; newPassword?: string }) || {};
      if (!currentPassword || !newPassword) {
        vercelRes.status(400).send(JSON.stringify({ message: 'currentPassword and newPassword required' }));
        return;
      }
      const user = await getPrisma().user.findUnique({ where: { id: token.userId } });
      if (!user) {
        vercelRes.status(404).send(JSON.stringify({ message: 'User not found' }));
        return;
      }
      const bcrypt = await import('bcryptjs');
      const valid = await bcrypt.compare(currentPassword, user.password);
      if (!valid) {
        vercelRes.status(401).send(JSON.stringify({ message: 'Current password is incorrect' }));
        return;
      }
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await getPrisma().user.update({ where: { id: token.userId }, data: { password: hashedPassword } });
      vercelRes.status(200).send(JSON.stringify({ message: 'Password updated successfully' }));
      return;
    }

    if (!token) {
      vercelRes.status(401).send(JSON.stringify({ message: 'Unauthorized' }));
      return;
    }

    // User endpoints
    if (url === '/api/user' && method === 'GET') {
      const user = await getPrisma().user.findUnique({ where: { id: token.userId } });
      if (!user) {
        vercelRes.status(404).send(JSON.stringify({ message: 'User not found' }));
        return;
      }
      vercelRes.status(200).send(JSON.stringify({ id: user.id, email: user.email, name: user.name }));
      return;
    }

    if (url === '/api/user' && method === 'PUT') {
      const { name } = (vercelReq.body as { name?: string }) || {};
      const user = await getPrisma().user.update({
        where: { id: token.userId },
        data: { name: name || undefined }
      });
      vercelRes.status(200).send(JSON.stringify({ id: user.id, email: user.email, name: user.name }));
      return;
    }

    if (url === '/api/user/me' && method === 'GET') {
      const user = await getPrisma().user.findUnique({ where: { id: token.userId } });
      if (!user) {
        vercelRes.status(404).send(JSON.stringify({ message: 'User not found' }));
        return;
      }
      vercelRes.status(200).send(JSON.stringify({ id: user.id, email: user.email, name: user.name }));
      return;
    }

    // Account endpoints
    if (url === '/api/accounts' && method === 'GET') {
      const accounts = await getPrisma().account.findMany({ where: { userId: token.userId } });
      vercelRes.status(200).send(JSON.stringify({ accounts }));
      return;
    }

    if (url === '/api/accounts' && method === 'POST') {
      const { name, type, balance, currency, icon, color } = (vercelReq.body as Record<string, unknown>) || {};
      if (!name || !type) {
        vercelRes.status(400).send(JSON.stringify({ message: 'Name and type required' }));
        return;
      }
      const account = await getPrisma().account.create({
        data: {
          userId: token.userId,
          name: String(name),
          type: String(type) as 'BANK' | 'EWALLET' | 'CASH' | 'CREDIT_CARD' | 'INVESTMENT',
          balance: Number(balance) || 0,
          currency: String(currency) || 'IDR',
          icon: String(icon) || 'wallet',
          color: String(color) || '#0EA5E9'
        }
      });
      vercelRes.status(201).send(JSON.stringify(account));
      return;
    }

    if (url === '/api/accounts/balance/total' && method === 'GET') {
      const accounts = await getPrisma().account.findMany({ where: { userId: token.userId } });
      const total = accounts.reduce((sum, a) => sum + a.balance, 0);
      vercelRes.status(200).send(JSON.stringify({ total }));
      return;
    }

    if (url.match(/^\/api\/accounts\/[^/]+$/) && method === 'GET') {
      const id = url.split('/')[3];
      const account = await getPrisma().account.findFirst({ where: { id, userId: token.userId } });
      if (!account) {
        vercelRes.status(404).send(JSON.stringify({ message: 'Account not found' }));
        return;
      }
      vercelRes.status(200).send(JSON.stringify(account));
      return;
    }

    if (url.match(/^\/api\/accounts\/[^/]+$/) && method === 'PUT') {
      const id = url.split('/')[3];
      const account = await getPrisma().account.findFirst({ where: { id, userId: token.userId } });
      if (!account) {
        vercelRes.status(404).send(JSON.stringify({ message: 'Account not found' }));
        return;
      }
      const updates = (vercelReq.body as Record<string, unknown>) || {};
      const updated = await getPrisma().account.update({
        where: { id },
        data: updates as Parameters<typeof getPrisma().account.update>[0]['data']
      });
      vercelRes.status(200).send(JSON.stringify(updated));
      return;
    }

    if (url.match(/^\/api\/accounts\/[^/]+$/) && method === 'DELETE') {
      const id = url.split('/')[3];
      await getPrisma().account.deleteMany({ where: { id, userId: token.userId } });
      vercelRes.status(204).send('');
      return;
    }

    // Category endpoints
    if (url === '/api/categories' && method === 'GET') {
      const categories = await getPrisma().category.findMany({ where: { userId: token.userId } });
      vercelRes.status(200).send(JSON.stringify({ categories }));
      return;
    }

    if (url === '/api/categories' && method === 'POST') {
      const { name, type, icon, color } = (vercelReq.body as Record<string, unknown>) || {};
      if (!name || !type) {
        vercelRes.status(400).send(JSON.stringify({ message: 'Name and type required' }));
        return;
      }
      const category = await getPrisma().category.create({
        data: {
          userId: token.userId,
          name: String(name),
          type: String(type) as 'INCOME' | 'EXPENSE',
          icon: String(icon) || 'tag',
          color: String(color) || '#8B5CF6'
        }
      });
      vercelRes.status(201).send(JSON.stringify(category));
      return;
    }

    if (url.match(/^\/api\/categories\/[^/]+$/) && method === 'GET') {
      const id = url.split('/')[3];
      const category = await getPrisma().category.findFirst({ where: { id, userId: token.userId } });
      if (!category) {
        vercelRes.status(404).send(JSON.stringify({ message: 'Category not found' }));
        return;
      }
      vercelRes.status(200).send(JSON.stringify(category));
      return;
    }

    if (url.match(/^\/api\/categories\/[^/]+$/) && method === 'PUT') {
      const id = url.split('/')[3];
      const updates = (vercelReq.body as Record<string, unknown>) || {};
      const updated = await getPrisma().category.update({
        where: { id },
        data: updates as Parameters<typeof getPrisma().category.update>[0]['data']
      });
      vercelRes.status(200).send(JSON.stringify(updated));
      return;
    }

    if (url.match(/^\/api\/categories\/[^/]+$/) && method === 'DELETE') {
      const id = url.split('/')[3];
      await getPrisma().category.deleteMany({ where: { id, userId: token.userId } });
      vercelRes.status(204).send('');
      return;
    }

    // Transaction endpoints
    if (url === '/api/transactions' && method === 'GET') {
      const transactions = await getPrisma().transaction.findMany({
        where: { userId: token.userId },
        include: { account: true, category: true },
        orderBy: { date: 'desc' }
      });
      vercelRes.status(200).send(JSON.stringify({ transactions }));
      return;
    }

    if (url === '/api/transactions/recent' && method === 'GET') {
      const transactions = await getPrisma().transaction.findMany({
        where: { userId: token.userId },
        include: { account: true, category: true },
        orderBy: { date: 'desc' },
        take: 5
      });
      vercelRes.status(200).send(JSON.stringify({ transactions }));
      return;
    }

    if (url === '/api/transactions/summary' && method === 'GET') {
      const transactions = await getPrisma().transaction.findMany({ where: { userId: token.userId } });
      const income = transactions.filter(t => t.type === 'INCOME').reduce((sum, t) => sum + t.amount, 0);
      const expense = transactions.filter(t => t.type === 'EXPENSE').reduce((sum, t) => sum + Math.abs(t.amount), 0);
      vercelRes.status(200).send(JSON.stringify({ income, expense, balance: income - expense }));
      return;
    }

    if (url === '/api/transactions' && method === 'POST') {
      const { accountId, categoryId, type, amount, description, date } = (vercelReq.body as Record<string, unknown>) || {};
      if (!accountId || !type || amount === undefined || !description) {
        vercelRes.status(400).send(JSON.stringify({ message: 'accountId, type, amount, description required' }));
        return;
      }
      const transaction = await getPrisma().transaction.create({
        data: {
          userId: token.userId,
          accountId: String(accountId),
          categoryId: categoryId ? String(categoryId) : null,
          type: String(type) as 'INCOME' | 'EXPENSE' | 'TRANSFER',
          amount: Number(amount),
          description: String(description),
          date: date ? new Date(String(date)) : new Date()
        }
      });
      vercelRes.status(201).send(JSON.stringify(transaction));
      return;
    }

    if (url.match(/^\/api\/transactions\/[^/]+$/) && method === 'GET') {
      const id = url.split('/')[3];
      const transaction = await getPrisma().transaction.findFirst({ where: { id, userId: token.userId } });
      if (!transaction) {
        vercelRes.status(404).send(JSON.stringify({ message: 'Transaction not found' }));
        return;
      }
      vercelRes.status(200).send(JSON.stringify(transaction));
      return;
    }

    if (url.match(/^\/api\/transactions\/[^/]+$/) && method === 'PUT') {
      const id = url.split('/')[3];
      const updates = (vercelReq.body as Record<string, unknown>) || {};
      const updated = await getPrisma().transaction.update({
        where: { id },
        data: updates as Parameters<typeof getPrisma().transaction.update>[0]['data']
      });
      vercelRes.status(200).send(JSON.stringify(updated));
      return;
    }

    if (url.match(/^\/api\/transactions\/[^/]+$/) && method === 'DELETE') {
      const id = url.split('/')[3];
      await getPrisma().transaction.deleteMany({ where: { id, userId: token.userId } });
      vercelRes.status(204).send('');
      return;
    }

    // Budget endpoints
    if (url === '/api/budgets' && method === 'GET') {
      const budgets = await getPrisma().budget.findMany({
        where: { userId: token.userId },
        include: { category: true }
      });
      vercelRes.status(200).send(JSON.stringify({ budgets }));
      return;
    }

    if (url === '/api/budgets/summary' && method === 'GET') {
      const budgets = await getPrisma().budget.findMany({ where: { userId: token.userId } });
      const totalBudget = budgets.reduce((sum, b) => sum + b.amount, 0);
      const totalSpent = budgets.reduce((sum, b) => sum + b.spent, 0);
      vercelRes.status(200).send(JSON.stringify({ totalBudget, totalSpent, remaining: totalBudget - totalSpent }));
      return;
    }

    if (url === '/api/budgets' && method === 'POST') {
      const { categoryId, amount, period, startDate, endDate } = (vercelReq.body as Record<string, unknown>) || {};
      if (!categoryId || !amount) {
        vercelRes.status(400).send(JSON.stringify({ message: 'categoryId and amount required' }));
        return;
      }
      const budget = await getPrisma().budget.create({
        data: {
          userId: token.userId,
          categoryId: String(categoryId),
          amount: Number(amount),
          spent: 0,
          period: String(period) || 'monthly',
          startDate: startDate ? new Date(String(startDate)) : new Date(),
          endDate: endDate ? new Date(String(endDate)) : new Date(new Date().getTime() + 30 * 24 * 60 * 60 * 1000)
        }
      });
      vercelRes.status(201).send(JSON.stringify(budget));
      return;
    }

    if (url.match(/^\/api\/budgets\/[^/]+$/) && method === 'GET') {
      const id = url.split('/')[3];
      const budget = await getPrisma().budget.findFirst({ where: { id, userId: token.userId }, include: { category: true } });
      if (!budget) {
        vercelRes.status(404).send(JSON.stringify({ message: 'Budget not found' }));
        return;
      }
      vercelRes.status(200).send(JSON.stringify(budget));
      return;
    }

    if (url.match(/^\/api\/budgets\/[^/]+\/spent$/) && method === 'PUT') {
      const id = url.split('/')[3];
      const { spent } = (vercelReq.body as { spent?: number }) || {};
      const budget = await getPrisma().budget.update({
        where: { id },
        data: { spent: spent || 0 }
      });
      vercelRes.status(200).send(JSON.stringify(budget));
      return;
    }

    if (url.match(/^\/api\/budgets\/[^/]+$/) && method === 'PUT') {
      const id = url.split('/')[3];
      const updates = (vercelReq.body as Record<string, unknown>) || {};
      const updated = await getPrisma().budget.update({
        where: { id },
        data: updates as Parameters<typeof getPrisma().budget.update>[0]['data']
      });
      vercelRes.status(200).send(JSON.stringify(updated));
      return;
    }

    if (url.match(/^\/api\/budgets\/[^/]+$/) && method === 'DELETE') {
      const id = url.split('/')[3];
      await getPrisma().budget.deleteMany({ where: { id, userId: token.userId } });
      vercelRes.status(204).send('');
      return;
    }

    // Goal endpoints
    if (url === '/api/goals' && method === 'GET') {
      const goals = await getPrisma().goal.findMany({ where: { userId: token.userId } });
      vercelRes.status(200).send(JSON.stringify({ goals }));
      return;
    }

    if (url === '/api/goals/overview' && method === 'GET') {
      const goals = await getPrisma().goal.findMany({ where: { userId: token.userId } });
      const totalTarget = goals.reduce((sum, g) => sum + g.targetAmount, 0);
      const totalSaved = goals.reduce((sum, g) => sum + g.currentAmount, 0);
      vercelRes.status(200).send(JSON.stringify({ totalTarget, totalSaved, progress: totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0 }));
      return;
    }

    if (url === '/api/goals' && method === 'POST') {
      const { name, targetAmount, deadline, icon, color } = (vercelReq.body as Record<string, unknown>) || {};
      if (!name || !targetAmount || !deadline) {
        vercelRes.status(400).send(JSON.stringify({ message: 'name, targetAmount, deadline required' }));
        return;
      }
      const goal = await getPrisma().goal.create({
        data: {
          userId: token.userId,
          name: String(name),
          targetAmount: Number(targetAmount),
          currentAmount: 0,
          deadline: new Date(String(deadline)),
          icon: String(icon) || 'target',
          color: String(color) || '#10B981'
        }
      });
      vercelRes.status(201).send(JSON.stringify(goal));
      return;
    }

    if (url.match(/^\/api\/goals\/[^/]+$/) && method === 'GET') {
      const id = url.split('/')[3];
      const goal = await getPrisma().goal.findFirst({ where: { id, userId: token.userId } });
      if (!goal) {
        vercelRes.status(404).send(JSON.stringify({ message: 'Goal not found' }));
        return;
      }
      vercelRes.status(200).send(JSON.stringify(goal));
      return;
    }

    if (url.match(/^\/api\/goals\/[^/]+$/) && method === 'PUT') {
      const id = url.split('/')[3];
      const updates = (vercelReq.body as Record<string, unknown>) || {};
      const updated = await getPrisma().goal.update({
        where: { id },
        data: updates as Parameters<typeof getPrisma().goal.update>[0]['data']
      });
      vercelRes.status(200).send(JSON.stringify(updated));
      return;
    }

    if (url.match(/^\/api\/goals\/[^/]+$/) && method === 'DELETE') {
      const id = url.split('/')[3];
      await getPrisma().goal.deleteMany({ where: { id, userId: token.userId } });
      vercelRes.status(204).send('');
      return;
    }

    if (url.match(/^\/api\/goals\/[^/]+\/contributions$/) && method === 'POST') {
      const id = url.split('/')[3];
      const { amount, date, note } = (vercelReq.body as { amount?: number; date?: string; note?: string }) || {};
      if (!amount || !date) {
        vercelRes.status(400).send(JSON.stringify({ message: 'amount and date required' }));
        return;
      }
      await getPrisma().goalContribution.create({
        data: {
          goalId: id,
          userId: token.userId,
          amount,
          date: new Date(date),
          note: note || null
        }
      });
      const goal = await getPrisma().goal.update({
        where: { id },
        data: { currentAmount: { increment: amount } }
      });
      vercelRes.status(201).send(JSON.stringify(goal));
      return;
    }

    if (url.match(/^\/api\/goals\/[^/]+\/contributions$/) && method === 'GET') {
      const id = url.split('/')[3];
      const contributions = await getPrisma().goalContribution.findMany({ where: { goalId: id, userId: token.userId } });
      vercelRes.status(200).send(JSON.stringify({ contributions }));
      return;
    }

    if (url.match(/^\/api\/goals\/[^/]+\/lock$/) && method === 'PATCH') {
      const id = url.split('/')[3];
      const goal = await getPrisma().goal.findFirst({ where: { id, userId: token.userId } });
      if (!goal) {
        vercelRes.status(404).send(JSON.stringify({ message: 'Goal not found' }));
        return;
      }
      const updated = await getPrisma().goal.update({
        where: { id },
        data: { locked: !goal.locked }
      });
      vercelRes.status(200).send(JSON.stringify(updated));
      return;
    }

    // Plan endpoints
    if (url === '/api/plans' && method === 'GET') {
      const plans = await getPrisma().plan.findMany({ where: { userId: token.userId }, include: { milestones: true } });
      vercelRes.status(200).send(JSON.stringify({ plans }));
      return;
    }

    if (url === '/api/plans' && method === 'POST') {
      const { name, description, status } = (vercelReq.body as Record<string, unknown>) || {};
      if (!name) {
        vercelRes.status(400).send(JSON.stringify({ message: 'name required' }));
        return;
      }
      const plan = await getPrisma().plan.create({
        data: {
          userId: token.userId,
          name: String(name),
          description: String(description) || '',
          status: String(status) || 'ACTIVE'
        }
      });
      vercelRes.status(201).send(JSON.stringify(plan));
      return;
    }

    if (url.match(/^\/api\/plans\/[^/]+$/) && method === 'GET') {
      const id = url.split('/')[3];
      const plan = await getPrisma().plan.findFirst({ where: { id, userId: token.userId }, include: { milestones: true } });
      if (!plan) {
        vercelRes.status(404).send(JSON.stringify({ message: 'Plan not found' }));
        return;
      }
      vercelRes.status(200).send(JSON.stringify(plan));
      return;
    }

    if (url.match(/^\/api\/plans\/[^/]+$/) && method === 'PUT') {
      const id = url.split('/')[3];
      const updates = (vercelReq.body as Record<string, unknown>) || {};
      const updated = await getPrisma().plan.update({
        where: { id },
        data: updates as Parameters<typeof getPrisma().plan.update>[0]['data']
      });
      vercelRes.status(200).send(JSON.stringify(updated));
      return;
    }

    if (url.match(/^\/api\/plans\/[^/]+$/) && method === 'DELETE') {
      const id = url.split('/')[3];
      await getPrisma().plan.deleteMany({ where: { id, userId: token.userId } });
      vercelRes.status(204).send('');
      return;
    }

    // Milestones endpoints
    if (url.match(/^\/api\/plans\/[^/]+\/milestones$/) && method === 'GET') {
      const planId = url.split('/')[3];
      const plan = await getPrisma().plan.findFirst({ where: { id: planId, userId: token.userId }, include: { milestones: true } });
      if (!plan) {
        vercelRes.status(404).send(JSON.stringify({ message: 'Plan not found' }));
        return;
      }
      vercelRes.status(200).send(JSON.stringify({ milestones: plan.milestones }));
      return;
    }

    if (url.match(/^\/api\/plans\/[^/]+\/milestones$/) && method === 'POST') {
      const planId = url.split('/')[3];
      const plan = await getPrisma().plan.findFirst({ where: { id: planId, userId: token.userId } });
      if (!plan) {
        vercelRes.status(404).send(JSON.stringify({ message: 'Plan not found' }));
        return;
      }
      const { title, description, targetDate, targetAmount } = (vercelReq.body as { title?: string; description?: string; targetDate?: string; targetAmount?: number }) || {};
      if (!title || !targetDate) {
        vercelRes.status(400).send(JSON.stringify({ message: 'title and targetDate required' }));
        return;
      }
      const milestone = await getPrisma().milestone.create({
        data: {
          planId,
          title,
          description: description || '',
          targetDate: new Date(targetDate),
          targetAmount: targetAmount || 0,
          order: 0
        }
      });
      vercelRes.status(201).send(JSON.stringify(milestone));
      return;
    }

    if (url.match(/^\/api\/plans\/[^/]+\/milestones\/[^/]+$/) && method === 'PUT') {
      const planId = url.split('/')[3];
      const milestoneId = url.split('/')[5];
      const plan = await getPrisma().plan.findFirst({ where: { id: planId, userId: token.userId } });
      if (!plan) {
        vercelRes.status(404).send(JSON.stringify({ message: 'Plan not found' }));
        return;
      }
      const updates = (vercelReq.body as Record<string, unknown>) || {};
      const updated = await getPrisma().milestone.update({
        where: { id: milestoneId },
        data: updates as Parameters<typeof getPrisma().milestone.update>[0]['data']
      });
      vercelRes.status(200).send(JSON.stringify(updated));
      return;
    }

    if (url.match(/^\/api\/plans\/[^/]+\/milestones\/[^/]+\/complete$/) && method === 'PATCH') {
      const planId = url.split('/')[3];
      const milestoneId = url.split('/')[5];
      const plan = await getPrisma().plan.findFirst({ where: { id: planId, userId: token.userId } });
      if (!plan) {
        vercelRes.status(404).send(JSON.stringify({ message: 'Plan not found' }));
        return;
      }
      const updated = await getPrisma().milestone.update({
        where: { id: milestoneId },
        data: { isCompleted: true, completedAt: new Date() }
      });
      vercelRes.status(200).send(JSON.stringify(updated));
      return;
    }

    if (url.match(/^\/api\/plans\/[^/]+\/milestones\/[^/]+$/) && method === 'DELETE') {
      const planId = url.split('/')[3];
      const milestoneId = url.split('/')[5];
      await getPrisma().plan.findFirst({ where: { id: planId, userId: token.userId } });
      await getPrisma().milestone.delete({ where: { id: milestoneId } });
      vercelRes.status(204).send('');
      return;
    }

    // Notification endpoints
    if (url === '/api/notifications' && method === 'GET') {
      const notifications = await getPrisma().notification.findMany({ where: { userId: token.userId }, orderBy: { createdAt: 'desc' } });
      vercelRes.status(200).send(JSON.stringify({ notifications }));
      return;
    }

    if (url === '/api/notifications/unread' && method === 'GET') {
      const notifications = await getPrisma().notification.findMany({ where: { userId: token.userId, isRead: false }, orderBy: { createdAt: 'desc' } });
      vercelRes.status(200).send(JSON.stringify({ notifications }));
      return;
    }

    if (url === '/api/notifications/unread/count' && method === 'GET') {
      const count = await getPrisma().notification.count({ where: { userId: token.userId, isRead: false } });
      vercelRes.status(200).send(JSON.stringify({ count }));
      return;
    }

    if (url.match(/^\/api\/notifications\/[^/]+\/read$/) && method === 'PATCH') {
      const id = url.split('/')[3];
      const updated = await getPrisma().notification.update({
        where: { id, userId: token.userId },
        data: { isRead: true }
      });
      vercelRes.status(200).send(JSON.stringify(updated));
      return;
    }

    if (url === '/api/notifications/read-all' && method === 'PATCH') {
      await getPrisma().notification.updateMany({
        where: { userId: token.userId, isRead: false },
        data: { isRead: true }
      });
      vercelRes.status(200).send(JSON.stringify({ success: true }));
      return;
    }

    if (url.match(/^\/api\/notifications\/[^/]+$/) && method === 'DELETE') {
      const id = url.split('/')[3];
      await getPrisma().notification.deleteMany({ where: { id, userId: token.userId } });
      vercelRes.status(204).send('');
      return;
    }

    // AI endpoints (mock - needs AI integration)
    if (url === '/api/ai/suggestions' && method === 'GET') {
      vercelRes.status(200).send(JSON.stringify({ suggestions: [] }));
      return;
    }

    if (url === '/api/ai/advice' && method === 'GET') {
      vercelRes.status(200).send(JSON.stringify({ advice: 'Track your expenses consistently to improve financial health.' }));
      return;
    }

    if (url === '/api/ai/ask' && method === 'POST') {
      const { question } = (vercelReq.body as { question?: string }) || {};
      vercelRes.status(200).send(JSON.stringify({ answer: 'AI features require additional setup. Please check back later.' }));
      return;
    }

    // Report endpoints (basic)
    if (url === '/api/reports' && method === 'GET') {
      const transactions = await getPrisma().transaction.findMany({ where: { userId: token.userId } });
      const income = transactions.filter(t => t.type === 'INCOME').reduce((sum, t) => sum + t.amount, 0);
      const expenses = transactions.filter(t => t.type === 'EXPENSE').reduce((sum, t) => sum + Math.abs(t.amount), 0);
      vercelRes.status(200).send(JSON.stringify({ income, expenses, savings: income - expenses, byCategory: [] }));
      return;
    }

    // 404 for unmatched routes
    vercelRes.status(404).send(JSON.stringify({ error: 'Not found', url, method }));
  } catch (err) {
    console.error('Handler Error:', err);
    const origin = vercelReq.headers.origin;
    if (ALLOWED_ORIGINS.includes(origin as string)) {
      vercelRes.setHeader('Access-Control-Allow-Origin', origin as string);
      vercelRes.setHeader('Access-Control-Allow-Credentials', 'true');
      vercelRes.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    }
    vercelRes.status(500).send(JSON.stringify({ error: 'Internal server error', message: String(err), stack: err instanceof Error ? err.stack : undefined }));
  }
}