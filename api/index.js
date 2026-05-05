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
      datasources: databaseUrl ? {
        db: { url: databaseUrl }
      } : undefined
    });
  }
  return prisma;
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

    // Auth endpoints
    if (url === '/api/auth/login' && method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
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

    if (url === '/api/auth/register' && method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
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

    // User
    if (url === '/api/user' && method === 'GET') {
      const user = await db.user.findUnique({ where: { id: token.userId } });
      if (!user) {
        res.status(404).send(JSON.stringify({ message: 'User not found' }));
        return;
      }
      res.status(200).send(JSON.stringify({ id: user.id, email: user.email, name: user.name }));
      return;
    }

    if (url === '/api/user/me' && method === 'GET') {
      const user = await db.user.findUnique({ where: { id: token.userId } });
      if (!user) {
        res.status(404).send(JSON.stringify({ message: 'User not found' }));
        return;
      }
      res.status(200).send(JSON.stringify({ id: user.id, email: user.email, name: user.name }));
      return;
    }

    // Accounts
    if (url === '/api/accounts' && method === 'GET') {
      const accounts = await db.account.findMany({ where: { userId: token.userId } });
      res.status(200).send(JSON.stringify({ accounts }));
      return;
    }

    // Categories
    if (url === '/api/categories' && method === 'GET') {
      const categories = await db.category.findMany({ where: { userId: token.userId } });
      res.status(200).send(JSON.stringify({ categories }));
      return;
    }

    // Transactions
    if (url === '/api/transactions' && method === 'GET') {
      const transactions = await db.transaction.findMany({
        where: { userId: token.userId },
        include: { account: true, category: true },
        orderBy: { date: 'desc' }
      });
      res.status(200).send(JSON.stringify({ transactions }));
      return;
    }

    // Budgets
    if (url === '/api/budgets' && method === 'GET') {
      const budgets = await db.budget.findMany({ where: { userId: token.userId }, include: { category: true } });
      res.status(200).send(JSON.stringify({ budgets }));
      return;
    }

    // Goals
    if (url === '/api/goals' && method === 'GET') {
      const goals = await db.goal.findMany({ where: { userId: token.userId } });
      res.status(200).send(JSON.stringify({ goals }));
      return;
    }

    // Plans
    if (url === '/api/plans' && method === 'GET') {
      const plans = await db.plan.findMany({ where: { userId: token.userId }, include: { milestones: true } });
      res.status(200).send(JSON.stringify({ plans }));
      return;
    }

    // Notifications
    if (url === '/api/notifications' && method === 'GET') {
      const notifications = await db.notification.findMany({ where: { userId: token.userId }, orderBy: { createdAt: 'desc' } });
      res.status(200).send(JSON.stringify({ notifications }));
      return;
    }

    // Reports
    if (url === '/api/reports' && method === 'GET') {
      const transactions = await db.transaction.findMany({ where: { userId: token.userId } });
      const income = transactions.filter(t => t.type === 'INCOME').reduce((sum, t) => sum + t.amount, 0);
      const expenses = transactions.filter(t => t.type === 'EXPENSE').reduce((sum, t) => sum + Math.abs(t.amount), 0);
      res.status(200).send(JSON.stringify({ income, expenses, savings: income - expenses, byCategory: [] }));
      return;
    }

    res.status(404).send(JSON.stringify({ error: 'Not found', url, method }));
  } catch (err) {
    console.error('Error:', err);
    res.status(500).send(JSON.stringify({ error: 'Internal server error', message: String(err) }));
  }
}