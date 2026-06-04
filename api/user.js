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

    // GET /api/user/me
    if (url === '/api/user/me' && method === 'GET') {
      const user = await db.user.findUnique({
        where: { id: token.userId },
        select: {
          id: true, email: true, name: true, avatar: true, role: true,
          subscriptionTier: true, trialStartedAt: true, trialEndsAt: true,
          subscriptionStartAt: true, subscriptionEndAt: true, createdAt: true,
        },
      });

      if (!user) {
        res.status(404).send(JSON.stringify({ error: 'User not found' }));
        return;
      }

      res.status(200).send(JSON.stringify({ user }));
      return;
    }

    // PUT /api/user/me
    if (url === '/api/user/me' && method === 'PUT') {
      const body = parseBody(req.body);
      const { name, avatar } = body || {};

      const user = await db.user.update({
        where: { id: token.userId },
        data: { name, avatar },
        select: {
          id: true, email: true, name: true, avatar: true, role: true,
          subscriptionTier: true, trialStartedAt: true, trialEndsAt: true,
          subscriptionStartAt: true, subscriptionEndAt: true,
        },
      });

      res.status(200).send(JSON.stringify({ user }));
      return;
    }

    // GET /api/user/preferences/notifications
    if (url === '/api/user/preferences/notifications' && method === 'GET') {
      const user = await db.user.findUnique({
        where: { id: token.userId },
        select: { preferences: true },
      });

      const defaults = {
        budgetWarning: true, goalMilestone: true, planReminder: false,
        accountAlert: false, dailySummary: false, recurringTransaction: false,
      };
      const prefs = { ...defaults, ...(user?.preferences || {}) };

      res.status(200).send(JSON.stringify({ preferences: prefs }));
      return;
    }

    // PUT /api/user/preferences/notifications
    if (url === '/api/user/preferences/notifications' && method === 'PUT') {
      const body = parseBody(req.body) || {};

      const user = await db.user.findUnique({
        where: { id: token.userId },
        select: { preferences: true },
      });

      const currentPrefs = user?.preferences || {};
      const newPrefs = { ...currentPrefs, ...body };

      await db.user.update({
        where: { id: token.userId },
        data: { preferences: newPrefs },
      });

      res.status(200).send(JSON.stringify({ preferences: newPrefs }));
      return;
    }

    res.status(404).send(JSON.stringify({ error: 'Not found', url, method }));
  } catch (err) {
    console.error('User handler error:', err);
    res.status(500).send(JSON.stringify({ message: 'Internal server error', error: String(err) }));
  } finally {
    if (db) {
      try { await db.$disconnect(); } catch {}
    }
  }
}