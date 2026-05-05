import { getPrisma, parseBody, setupCors, parseToken } from './utils.js';

export default async function handler(req, res) {
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

  const db = await getPrisma();

  // GET all accounts
  if (url === '/api/accounts' && method === 'GET') {
    const accounts = await db.account.findMany({ where: { userId: token.userId } });
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
        isArchived: false
      }
    });
    res.status(201).send(JSON.stringify({ account }));
    return;
  }

  // GET account by ID
  const accountMatch = url.match(/^\/api\/accounts\/([a-f0-9-]+)$/i);
  if (accountMatch && method === 'GET') {
    const account = await db.account.findFirst({ where: { id: accountMatch[1], userId: token.userId } });
    if (!account) {
      res.status(404).send(JSON.stringify({ message: 'Account not found' }));
      return;
    }
    res.status(200).send(JSON.stringify({ account }));
    return;
  }

  // PUT update account
  if (accountMatch && method === 'PUT') {
    const body = parseBody(req.body);
    const account = await db.account.update({
      where: { id: accountMatch[1] },
      data: body
    });
    res.status(200).send(JSON.stringify({ account }));
    return;
  }

  // DELETE account
  if (accountMatch && method === 'DELETE') {
    await db.account.delete({ where: { id: accountMatch[1] } });
    res.status(204).send(JSON.stringify({ message: 'Deleted' }));
    return;
  }

  // GET total balance
  if (url === '/api/accounts/balance/total' && method === 'GET') {
    const accounts = await db.account.findMany({ where: { userId: token.userId, isArchived: false } });
    const total = accounts.reduce((sum, acc) => sum + Number(acc.balance), 0);
    res.status(200).send(JSON.stringify({ total }));
    return;
  }

  // User endpoint
  if (url === '/api/user/me' && method === 'GET') {
    const user = await db.user.findUnique({ where: { id: token.userId } });
    if (!user) {
      res.status(404).send(JSON.stringify({ message: 'User not found' }));
      return;
    }
    res.status(200).send(JSON.stringify({ user: { id: user.id, email: user.email, name: user.name } }));
    return;
  }

  if (url === '/api/user/me' && method === 'PUT') {
    const body = parseBody(req.body);
    const user = await db.user.update({
      where: { id: token.userId },
      data: { name: body.name }
    });
    res.status(200).send(JSON.stringify({ user: { id: user.id, email: user.email, name: user.name } }));
    return;
  }

  res.status(404).send(JSON.stringify({ error: 'Not found', url, method }));
}