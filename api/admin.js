import { getPrisma, parseBody, setupCors, parseToken } from './utils.js';

async function isAdmin(userId) {
  const db = await getPrisma();
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  return user?.role === 'ADMIN';
}

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

    db = await getPrisma();

    // GET /api/admin/pricing (public)
    if (url === '/api/admin/pricing' && method === 'GET') {
      const pricings = await db.pricing.findMany({ orderBy: { app: 'asc' } });
      res.status(200).send(JSON.stringify(pricings));
      return;
    }

    const token = parseToken(req.headers.authorization);
    if (!token) {
      res.status(401).send(JSON.stringify({ message: 'Unauthorized' }));
      return;
    }

    const admin = await isAdmin(token.userId);
    if (!admin && !url.includes('/pricing')) {
      res.status(403).send(JSON.stringify({ message: 'Admin access required' }));
      return;
    }

    // GET /api/admin/users
    if (url === '/api/admin/users' && method === 'GET') {
      const queryParams = new URL(req.url, 'http://localhost').searchParams;
      const page = parseInt(queryParams.get('page') || '1');
      const limit = parseInt(queryParams.get('limit') || '10');
      const search = queryParams.get('search');

      const where = {};
      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ];
      }

      const [users, total] = await Promise.all([
        db.user.findMany({
          where,
          select: {
            id: true, name: true, email: true, role: true,
            subscriptionTier: true, createdAt: true,
          },
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        db.user.count({ where }),
      ]);

      res.status(200).send(JSON.stringify({ users, total, page, limit }));
      return;
    }

    // GET /api/admin/users/:id
    const userMatch = url.match(/^\/api\/admin\/users\/([a-f0-9-]+)$/i);
    if (userMatch && method === 'GET') {
      const user = await db.user.findUnique({
        where: { id: userMatch[1] },
        select: {
          id: true, name: true, email: true, role: true,
          subscriptionTier: true, createdAt: true,
          trialStartedAt: true, trialEndsAt: true,
          subscriptionStartAt: true, subscriptionEndAt: true,
        },
      });

      if (!user) {
        res.status(404).send(JSON.stringify({ error: 'User not found' }));
        return;
      }

      res.status(200).send(JSON.stringify(user));
      return;
    }

    // PATCH /api/admin/users/:id
    if (userMatch && method === 'PATCH') {
      const body = parseBody(req.body);
      const { name, role } = body || {};

      const user = await db.user.update({
        where: { id: userMatch[1] },
        data: { name, role },
        select: { id: true, name: true, email: true, role: true },
      });

      res.status(200).send(JSON.stringify(user));
      return;
    }

    // DELETE /api/admin/users/:id
    if (userMatch && method === 'DELETE') {
      await db.user.delete({ where: { id: userMatch[1] } });
      res.status(204).send(JSON.stringify({ success: true }));
      return;
    }

    // POST /api/admin/users/:id/reset-password
    const resetPassMatch = url.match(/^\/api\/admin\/users\/([a-f0-9-]+)\/reset-password$/i);
    if (resetPassMatch && method === 'POST') {
      const tempPassword = Math.random().toString(36).substring(2, 10);
      const bcrypt = await import('bcryptjs');
      const hashed = await bcrypt.hash(tempPassword, 10);

      await db.user.update({
        where: { id: resetPassMatch[1] },
        data: { password: hashed },
      });

      res.status(200).send(JSON.stringify({ 
        message: 'Password direset',
        temporaryPassword: tempPassword 
      }));
      return;
    }

    // GET /api/admin/subscriptions
    if (url === '/api/admin/subscriptions' && method === 'GET') {
      const [active, pending] = await Promise.all([
        db.user.findMany({
          where: { subscriptionTier: 'PRO' },
          select: { id: true, name: true, email: true, subscriptionEndAt: true },
          orderBy: { subscriptionEndAt: 'asc' },
          take: 50,
        }),
        db.payment.findMany({
          where: { status: 'PENDING' },
          include: { user: { select: { name: true, email: true } } },
          orderBy: { createdAt: 'desc' },
          take: 50,
        }),
      ]);

      res.status(200).send(JSON.stringify({
        overview: { activeCount: active.length, pendingCount: pending.length },
        active,
        pending,
      }));
      return;
    }

    // PATCH /api/admin/subscriptions/:userId/tier
    const tierMatch = url.match(/^\/api\/admin\/subscriptions\/([a-f0-9-]+)\/tier$/i);
    if (tierMatch && method === 'PATCH') {
      const body = parseBody(req.body);
      const { tier } = body || {};

      const updateData = { subscriptionTier: tier };
      if (tier === 'PRO') {
        const now = new Date();
        const endDate = new Date(now);
        endDate.setMonth(endDate.getMonth() + 1);
        updateData.subscriptionStartAt = now;
        updateData.subscriptionEndAt = endDate;
      }

      const user = await db.user.update({
        where: { id: tierMatch[1] },
        data: updateData,
      });

      res.status(200).send(JSON.stringify(user));
      return;
    }

    res.status(404).send(JSON.stringify({ error: 'Not found', url, method }));
  } catch (err) {
    console.error('Admin handler error:', err);
    res.status(500).send(JSON.stringify({ message: 'Internal server error', error: String(err) }));
  } finally {
    if (db) {
      try { await db.$disconnect(); } catch {}
    }
  }
}