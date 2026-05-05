import { getPrisma, parseBody, simpleToken, setupCors } from './utils.js';

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

  const db = await getPrisma();

  // Health check
  if (url === '/api/health' && method === 'GET') {
    await db.$connect();
    res.status(200).send(JSON.stringify({ status: 'ok', database: 'connected' }));
    return;
  }

  // Login
  if (url === '/api/auth/login' && method === 'POST') {
    const body = parseBody(req.body);
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

  // Register
  if (url === '/api/auth/register' && method === 'POST') {
    const body = parseBody(req.body);
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

  // Auth me
  const token = parseToken(req.headers.authorization);
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

  res.status(404).send(JSON.stringify({ error: 'Not found', url, method }));
}