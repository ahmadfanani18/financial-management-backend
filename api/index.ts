import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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
      await prisma.$connect();
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
      const user = await prisma.user.findUnique({ where: { email } });
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
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        vercelRes.status(400).send(JSON.stringify({ message: 'Email already exists' }));
        return;
      }
      const bcrypt = await import('bcryptjs');
      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await prisma.user.create({
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
      const user = await prisma.user.findUnique({ where: { id: token.userId } });
      if (!user) {
        vercelRes.status(404).send(JSON.stringify({ message: 'User not found' }));
        return;
      }
      vercelRes.status(200).send(JSON.stringify({ id: user.id, email: user.email, name: user.name }));
      return;
    }

    if (!token) {
      vercelRes.status(401).send(JSON.stringify({ message: 'Unauthorized' }));
      return;
    }

    // User endpoints
    if (url === '/api/user' && method === 'GET') {
      const user = await prisma.user.findUnique({ where: { id: token.userId } });
      if (!user) {
        vercelRes.status(404).send(JSON.stringify({ message: 'User not found' }));
        return;
      }
      vercelRes.status(200).send(JSON.stringify({ id: user.id, email: user.email, name: user.name }));
      return;
    }

    if (url === '/api/user/me' && method === 'GET') {
      const user = await prisma.user.findUnique({ where: { id: token.userId } });
      if (!user) {
        vercelRes.status(404).send(JSON.stringify({ message: 'User not found' }));
        return;
      }
      vercelRes.status(200).send(JSON.stringify({ id: user.id, email: user.email, name: user.name }));
      return;
    }

    // Account endpoints
    if (url === '/api/accounts' && method === 'GET') {
      const accounts = await prisma.account.findMany({ where: { userId: token.userId } });
      vercelRes.status(200).send(JSON.stringify({ accounts }));
      return;
    }

    // Category endpoints
    if (url === '/api/categories' && method === 'GET') {
      const categories = await prisma.category.findMany({ where: { userId: token.userId } });
      vercelRes.status(200).send(JSON.stringify({ categories }));
      return;
    }

    // Transaction endpoints
    if (url === '/api/transactions' && method === 'GET') {
      const transactions = await prisma.transaction.findMany({
        where: { userId: token.userId },
        include: { account: true, category: true },
        orderBy: { date: 'desc' }
      });
      vercelRes.status(200).send(JSON.stringify({ transactions }));
      return;
    }

    // Budget endpoints
    if (url === '/api/budgets' && method === 'GET') {
      const budgets = await prisma.budget.findMany({
        where: { userId: token.userId },
        include: { category: true }
      });
      vercelRes.status(200).send(JSON.stringify({ budgets }));
      return;
    }

    // Goal endpoints
    if (url === '/api/goals' && method === 'GET') {
      const goals = await prisma.goal.findMany({ where: { userId: token.userId } });
      vercelRes.status(200).send(JSON.stringify({ goals }));
      return;
    }

    // Plan endpoints
    if (url === '/api/plans' && method === 'GET') {
      const plans = await prisma.plan.findMany({ where: { userId: token.userId }, include: { milestones: true } });
      vercelRes.status(200).send(JSON.stringify({ plans }));
      return;
    }

    // Notification endpoints
    if (url === '/api/notifications' && method === 'GET') {
      const notifications = await prisma.notification.findMany({ where: { userId: token.userId }, orderBy: { createdAt: 'desc' } });
      vercelRes.status(200).send(JSON.stringify({ notifications }));
      return;
    }

    // Report endpoints
    if (url === '/api/reports' && method === 'GET') {
      const transactions = await prisma.transaction.findMany({ where: { userId: token.userId } });
      const income = transactions.filter(t => t.type === 'INCOME').reduce((sum, t) => sum + t.amount, 0);
      const expenses = transactions.filter(t => t.type === 'EXPENSE').reduce((sum, t) => sum + Math.abs(t.amount), 0);
      vercelRes.status(200).send(JSON.stringify({ income, expenses, savings: income - expenses, byCategory: [] }));
      return;
    }

    // 404 for unmatched routes
    vercelRes.status(404).send(JSON.stringify({ error: 'Not found', url, method }));
  } catch (err) {
    console.error('Error:', err);
    vercelRes.status(500).send(JSON.stringify({ error: 'Internal server error', message: String(err) }));
  }
}