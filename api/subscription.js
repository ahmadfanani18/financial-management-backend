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

    db = await getPrisma();

    // GET /api/subscription/pricing (public)
    if (url === '/api/subscription/pricing' && method === 'GET') {
      const pricings = await db.pricing.findMany({ orderBy: { app: 'asc' } });
      res.status(200).send(JSON.stringify(pricings));
      return;
    }

    const token = parseToken(req.headers.authorization);
    if (!token) {
      res.status(401).send(JSON.stringify({ message: 'Unauthorized' }));
      return;
    }

    // POST /api/subscription/activate-trial
    if (url === '/api/subscription/activate-trial' && method === 'POST') {
      const user = await db.user.findUnique({
        where: { id: token.userId },
        select: { trialStartedAt: true, subscriptionTier: true },
      });

      if (!user) {
        res.status(404).send(JSON.stringify({ success: false, message: 'User not found' }));
        return;
      }

      if (user.trialStartedAt) {
        res.status(400).send(JSON.stringify({ success: false, message: 'Trial sudah pernah digunakan' }));
        return;
      }

      const now = new Date();
      const trialEndsAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      await db.user.update({
        where: { id: token.userId },
        data: {
          subscriptionTier: 'TRIAL',
          trialStartedAt: now,
          trialEndsAt: trialEndsAt,
        },
      });

      res.status(200).send(JSON.stringify({ success: true, message: 'Trial diaktifkan untuk 7 hari' }));
      return;
    }

    // GET /api/subscription/features
    if (url === '/api/subscription/features' && method === 'GET') {
      const user = await db.user.findUnique({
        where: { id: token.userId },
        select: { subscriptionTier: true, trialEndsAt: true },
      });

      if (!user) {
        res.status(404).send(JSON.stringify({ features: null }));
        return;
      }

      const tier = user.subscriptionTier === 'PRO' ? 'PRO' 
        : (user.subscriptionTier === 'TRIAL' && user.trialEndsAt && user.trialEndsAt > new Date()) ? 'PRO' 
        : 'FREE';

      if (tier === 'PRO') {
        res.status(200).send(JSON.stringify({
          features: {
            aiTips: true,
            reports: true,
            export: true,
            unlimitedTransactions: true,
            unlimitedGoals: true,
            unlimitedAccounts: true,
            maxAccounts: -1,
            maxTransactions: -1,
            maxGoals: -1,
          },
        }));
      } else {
        res.status(200).send(JSON.stringify({
          features: {
            aiTips: false,
            reports: false,
            export: false,
            unlimitedTransactions: false,
            unlimitedGoals: false,
            unlimitedAccounts: false,
            maxAccounts: 1,
            maxTransactions: 5,
            maxGoals: 3,
          },
        }));
      }
      return;
    }

    res.status(404).send(JSON.stringify({ error: 'Not found', url, method }));
  } catch (err) {
    console.error('Subscription handler error:', err);
    res.status(500).send(JSON.stringify({ message: 'Internal server error', error: String(err) }));
  } finally {
    if (db) {
      try { await db.$disconnect(); } catch {}
    }
  }
}