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

    // GET all accounts
    if (url === '/api/accounts' && method === 'GET') {
      const accounts = await db.account.findMany({
        where: { userId: token.userId },
        orderBy: { createdAt: 'desc' },
      });
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
          isArchived: false,
        },
      });
      res.status(201).send(JSON.stringify({ account }));
      return;
    }

    // GET account by ID
    const accountMatch = url.match(/^\/api\/accounts\/([a-f0-9-]+)$/i);
    if (accountMatch && method === 'GET') {
      const account = await db.account.findFirst({ where: { id: accountMatch[1], userId: token.userId } });
      if (!account) {
        res.status(404).send(JSON.stringify({ message: 'Akun tidak ditemukan' }));
        return;
      }
      res.status(200).send(JSON.stringify({ account }));
      return;
    }

    // PUT update account
    if (accountMatch && method === 'PUT') {
      const body = parseBody(req.body);
      const existing = await db.account.findFirst({ where: { id: accountMatch[1], userId: token.userId } });
      if (!existing) {
        res.status(404).send(JSON.stringify({ message: 'Akun tidak ditemukan' }));
        return;
      }
      const account = await db.account.update({
        where: { id: accountMatch[1] },
        data: body,
      });
      res.status(200).send(JSON.stringify({ account }));
      return;
    }

    // DELETE account
    if (accountMatch && method === 'DELETE') {
      const existing = await db.account.findFirst({ where: { id: accountMatch[1], userId: token.userId } });
      if (!existing) {
        res.status(404).send(JSON.stringify({ message: 'Akun tidak ditemukan' }));
        return;
      }
      await db.account.delete({ where: { id: accountMatch[1] } });
      res.status(204).send(JSON.stringify({ message: 'Deleted' }));
      return;
    }

    // GET total balance
    if (url === '/api/accounts/balance/total' && method === 'GET') {
      const accounts = await db.account.findMany({
        where: { userId: token.userId, isArchived: false },
        select: { balance: true },
      });
      const total = accounts.reduce((sum, acc) => sum + parseFloat(acc.balance), 0);
      res.status(200).send(JSON.stringify({ total }));
      return;
    }

    // PATCH archive account
    const archiveMatch = url.match(/^\/api\/accounts\/([a-f0-9-]+)\/archive$/i);
    if (archiveMatch && method === 'PATCH') {
      const existing = await db.account.findFirst({ where: { id: archiveMatch[1], userId: token.userId } });
      if (!existing) {
        res.status(404).send(JSON.stringify({ message: 'Akun tidak ditemukan' }));
        return;
      }
      const account = await db.account.update({
        where: { id: archiveMatch[1] },
        data: { isArchived: true },
      });
      res.status(200).send(JSON.stringify({ account }));
      return;
    }

    // PATCH toggle lock
    const lockMatch = url.match(/^\/api\/accounts\/([a-f0-9-]+)\/lock$/i);
    if (lockMatch && method === 'PATCH') {
      const body = parseBody(req.body);
      const existing = await db.account.findFirst({ where: { id: lockMatch[1], userId: token.userId } });
      if (!existing) {
        res.status(404).send(JSON.stringify({ message: 'Akun tidak ditemukan' }));
        return;
      }
      const account = await db.account.update({
        where: { id: lockMatch[1] },
        data: { isLocked: !existing.isLocked, lockedReason: body.reason || null },
      });
      res.status(200).send(JSON.stringify({ account }));
      return;
    }

    // PATCH link to goal
    const linkGoalMatch = url.match(/^\/api\/accounts\/([a-f0-9-]+)\/link-goal$/i);
    if (linkGoalMatch && method === 'PATCH') {
      const body = parseBody(req.body);
      const existing = await db.account.findFirst({ where: { id: linkGoalMatch[1], userId: token.userId } });
      if (!existing) {
        res.status(404).send(JSON.stringify({ message: 'Akun tidak ditemukan' }));
        return;
      }
      if (body.goalId) {
        const goal = await db.goal.findFirst({ where: { id: body.goalId, userId: token.userId } });
        if (!goal) {
          res.status(404).send(JSON.stringify({ message: 'Goal tidak ditemukan' }));
          return;
        }
      }
      const account = await db.account.update({
        where: { id: linkGoalMatch[1] },
        data: { linkedGoalId: body.goalId || null },
      });
      res.status(200).send(JSON.stringify({ account }));
      return;
    }

    // User endpoint
    if (url === '/api/user/me' && method === 'GET') {
      const user = await db.user.findUnique({ where: { id: token.userId } });
      if (!user) {
        res.status(404).send(JSON.stringify({ message: 'User not found' }));
        return;
      }
      res.status(200).send(JSON.stringify({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        subscriptionTier: user.subscriptionTier,
        trialStartedAt: user.trialStartedAt,
        trialEndsAt: user.trialEndsAt,
        subscriptionStartAt: user.subscriptionStartAt,
        subscriptionEndAt: user.subscriptionEndAt,
      }));
      return;
    }

    if (url === '/api/user/me' && method === 'PUT') {
      const body = parseBody(req.body);
      const user = await db.user.update({
        where: { id: token.userId },
        data: { name: body.name },
      });
      res.status(200).send(JSON.stringify({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        subscriptionTier: user.subscriptionTier,
        trialStartedAt: user.trialStartedAt,
        trialEndsAt: user.trialEndsAt,
        subscriptionStartAt: user.subscriptionStartAt,
        subscriptionEndAt: user.subscriptionEndAt,
      }));
      return;
    }

    res.status(404).send(JSON.stringify({ error: 'Not found', url, method }));
  } catch (err) {
    console.error('Accounts handler error:', err);
    res.status(500).send(JSON.stringify({ message: 'Internal server error', error: String(err) }));
  } finally {
    if (db) {
      try { await db.$disconnect(); } catch {}
    }
  }
}