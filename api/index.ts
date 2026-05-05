const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'https://financial-management-frontend.vercel.app',
  'https://financial-management-frontend-seven.vercel.app'
];

const users: Array<{ id: number; email: string; password: string; name: string }> = [
  { id: 1, email: 'test@test.com', password: 'password123', name: 'Test User' }
];

const accounts: Array<{ id: number; userId: number; name: string; type: string; balance: number }> = [
  { id: 1, userId: 1, name: 'Bank BCA', type: 'bank', balance: 5000000 },
  { id: 2, userId: 1, name: 'Cash', type: 'cash', balance: 1000000 }
];

const categories: Array<{ id: number; userId: number; name: string; type: string }> = [
  { id: 1, userId: 1, name: 'Salary', type: 'income' },
  { id: 2, userId: 1, name: 'Food', type: 'expense' },
  { id: 3, userId: 1, name: 'Transport', type: 'expense' }
];

const transactions: Array<{ id: number; userId: number; accountId: number; categoryId: number; amount: number; description: string; date: string }> = [
  { id: 1, userId: 1, accountId: 1, categoryId: 1, amount: 5000000, description: 'Monthly Salary', date: '2026-05-01' },
  { id: 2, userId: 1, accountId: 1, categoryId: 2, amount: -150000, description: 'Grocery', date: '2026-05-02' }
];

let userIdCounter = 2;
let accountIdCounter = 3;
let categoryIdCounter = 4;
let transactionIdCounter = 3;

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

  const url = vercelReq.url || '/';
  const method = vercelReq.method;
  const token = parseToken(vercelReq.headers.authorization as string);

  if (url === '/api/health' && method === 'GET') {
    vercelRes.status(200).send(JSON.stringify({ status: 'ok' }));
    return;
  }

  if (url === '/api/auth/login' && method === 'POST') {
    const { email, password } = (vercelReq.body as { email?: string; password?: string }) || {};
    if (!email || !password) {
      vercelRes.status(400).send(JSON.stringify({ message: 'Email and password required' }));
      return;
    }
    const user = users.find(u => u.email === email && u.password === password);
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
    if (users.find(u => u.email === email)) {
      vercelRes.status(400).send(JSON.stringify({ message: 'Email already exists' }));
      return;
    }
    const newUser = { id: userIdCounter++, email, password, name: name || email.split('@')[0] };
    users.push(newUser);
    const token = simpleToken(newUser.id, newUser.email);
    vercelRes.status(201).send(JSON.stringify({ token, user: { id: newUser.id, email: newUser.email, name: newUser.name } }));
    return;
  }

  if (!token) {
    vercelRes.status(401).send(JSON.stringify({ message: 'Unauthorized' }));
    return;
  }

  if (url === '/api/user' && method === 'GET') {
    const user = users.find(u => u.id === token.userId);
    if (!user) {
      vercelRes.status(404).send(JSON.stringify({ message: 'User not found' }));
      return;
    }
    vercelRes.status(200).send(JSON.stringify({ id: user.id, email: user.email, name: user.name }));
    return;
  }

  if (url === '/api/accounts' && method === 'GET') {
    const userAccounts = accounts.filter(a => a.userId === token.userId);
    vercelRes.status(200).send(JSON.stringify(userAccounts));
    return;
  }

  if (url === '/api/accounts' && method === 'POST') {
    const { name, type, balance } = (vercelReq.body as { name?: string; type?: string; balance?: number }) || {};
    if (!name || !type) {
      vercelRes.status(400).send(JSON.stringify({ message: 'Name and type required' }));
      return;
    }
    const newAccount = { id: accountIdCounter++, userId: token.userId, name, type, balance: balance || 0 };
    accounts.push(newAccount);
    vercelRes.status(201).send(JSON.stringify(newAccount));
    return;
  }

  if (url === '/api/categories' && method === 'GET') {
    const userCategories = categories.filter(c => c.userId === token.userId);
    vercelRes.status(200).send(JSON.stringify(userCategories));
    return;
  }

  if (url === '/api/categories' && method === 'POST') {
    const { name, type } = (vercelReq.body as { name?: string; type?: string }) || {};
    if (!name || !type) {
      vercelRes.status(400).send(JSON.stringify({ message: 'Name and type required' }));
      return;
    }
    const newCategory = { id: categoryIdCounter++, userId: token.userId, name, type };
    categories.push(newCategory);
    vercelRes.status(201).send(JSON.stringify(newCategory));
    return;
  }

  if (url === '/api/transactions' && method === 'GET') {
    const userTransactions = transactions.filter(t => t.userId === token.userId);
    vercelRes.status(200).send(JSON.stringify(userTransactions));
    return;
  }

  if (url === '/api/transactions' && method === 'POST') {
    const { accountId, categoryId, amount, description, date } = (vercelReq.body as { accountId?: number; categoryId?: number; amount?: number; description?: string; date?: string }) || {};
    if (!accountId || !categoryId || amount === undefined || !description) {
      vercelRes.status(400).send(JSON.stringify({ message: 'accountId, categoryId, amount, description required' }));
      return;
    }
    const newTransaction = { id: transactionIdCounter++, userId: token.userId, accountId, categoryId, amount, description, date: date || new Date().toISOString().split('T')[0] };
    transactions.push(newTransaction);
    vercelRes.status(201).send(JSON.stringify(newTransaction));
    return;
  }

  vercelRes.status(404).send(JSON.stringify({ error: 'Not found', url, method }));
}