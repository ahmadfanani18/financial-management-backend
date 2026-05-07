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
    const income = transactions.filter(t => t.type === 'INCOME').reduce((sum, t) => sum + Number(t.amount), 0);
    const expense = transactions.filter(t => t.type === 'EXPENSE').reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);
    res.status(200).send(JSON.stringify({ income, expense, balance: income - expense }));
    return;
  }

  res.status(404).send(JSON.stringify({ error: 'Not found', url, method }));
  } catch (err) {
    console.error('Transactions handler error:', err);
    res.status(500).send(JSON.stringify({ message: 'Internal server error', error: String(err) }));
  } finally {
    if (db) {
      try { await db.$disconnect(); } catch {}
    }
  }
}