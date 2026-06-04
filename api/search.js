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

    // GET /api/search?q=xxx
    if (url === '/api/search' && method === 'GET') {
      const queryParams = new URL(req.url, 'http://localhost').searchParams;
      const q = queryParams.get('q');
      const limit = parseInt(queryParams.get('limit') || '5');

      if (!q || q.length < 1) {
        res.status(400).send(JSON.stringify({ message: 'Query "q" is required' }));
        return;
      }

      const searchPattern = { contains: q, mode: 'insensitive' };

      const [transactions, accounts, categories, budgets, goals, plans] = await Promise.all([
        db.transaction.findMany({
          where: { userId: token.userId, OR: [{ description: searchPattern }] },
          take: limit,
          orderBy: { date: 'desc' },
          select: { id: true, description: true, date: true, amount: true },
        }),
        db.account.findMany({
          where: { userId: token.userId, name: searchPattern },
          take: limit,
          select: { id: true, name: true, type: true },
        }),
        db.category.findMany({
          where: { userId: token.userId, name: searchPattern },
          take: limit,
          select: { id: true, name: true, type: true },
        }),
        db.budget.findMany({
          where: { userId: token.userId, category: { name: searchPattern } },
          take: limit,
          include: { category: { select: { name: true } } },
        }),
        db.goal.findMany({
          where: { userId: token.userId, name: searchPattern },
          take: limit,
          select: { id: true, name: true, targetAmount: true, currentAmount: true },
        }),
        db.plan.findMany({
          where: { userId: token.userId, name: searchPattern },
          take: limit,
          select: { id: true, name: true, status: true },
        }),
      ]);

      const budgetsFormatted = budgets.map(b => ({
        id: b.id,
        categoryName: b.category?.name || '',
        amount: b.amount,
      }));

      res.status(200).send(JSON.stringify({
        transactions,
        accounts,
        categories,
        budgets: budgetsFormatted,
        goals,
        plans,
        total: transactions.length + accounts.length + categories.length + budgetsFormatted.length + goals.length + plans.length,
      }));
      return;
    }

    res.status(404).send(JSON.stringify({ error: 'Not found', url, method }));
  } catch (err) {
    console.error('Search handler error:', err);
    res.status(500).send(JSON.stringify({ message: 'Internal server error', error: String(err) }));
  } finally {
    if (db) {
      try { await db.$disconnect(); } catch {}
    }
  }
}