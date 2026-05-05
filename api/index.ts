const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'https://financial-management-frontend.vercel.app',
  'https://financial-management-frontend-seven.vercel.app'
];

const users: Array<{ id: number; email: string; password: string; name: string }> = [
  { id: 1, email: 'test@test.com', password: 'password123', name: 'Test User' }
];

const db = {
  accounts: [
    { id: '1', userId: 1, name: 'Bank BCA', type: 'BANK', balance: 5000000, currency: 'IDR', icon: 'wallet', color: '#0EA5E9' },
    { id: '2', userId: 1, name: 'Cash', type: 'CASH', balance: 1000000, currency: 'IDR', icon: 'wallet', color: '#10B981' }
  ],
  categories: [
    { id: '1', userId: 1, name: 'Salary', type: 'INCOME', icon: 'briefcase', color: '#10B981' },
    { id: '2', userId: 1, name: 'Food', type: 'EXPENSE', icon: 'utensils', color: '#F59E0B' },
    { id: '3', userId: 1, name: 'Transport', type: 'EXPENSE', icon: 'car', color: '#3B82F6' }
  ],
  transactions: [
    { id: '1', userId: 1, accountId: '1', categoryId: '1', type: 'INCOME', amount: 5000000, description: 'Monthly Salary', date: '2026-05-01' },
    { id: '2', userId: 1, accountId: '1', categoryId: '2', type: 'EXPENSE', amount: -150000, description: 'Grocery', date: '2026-05-02' }
  ],
  budgets: [
    { id: '1', userId: 1, categoryId: '2', amount: 500000, spent: 150000, period: 'monthly', startDate: '2026-05-01', endDate: '2026-05-31' }
  ],
  goals: [
    { id: '1', userId: 1, name: 'Emergency Fund', targetAmount: 10000000, currentAmount: 5000000, deadline: '2026-12-31', icon: 'target', color: '#10B981', locked: false }
  ],
  plans: [
    { id: '1', userId: 1, name: '2026 Financial Plan', description: 'Yearly financial goals', status: 'active', milestones: [
      { id: '1', title: 'Build Emergency Fund', description: 'Save 3 months expenses', targetDate: '2026-06-30', targetAmount: 5000000, goalId: null, isCompleted: false, completedAt: null, order: 0 },
      { id: '2', title: 'Invest in Index Funds', description: 'Start monthly investment', targetDate: '2026-09-30', targetAmount: 10000000, goalId: null, isCompleted: false, completedAt: null, order: 1 }
    ] }
  ],
  notifications: [
    { id: '1', userId: 1, title: 'Welcome', message: 'Welcome to Financial Management!', read: false, createdAt: '2026-05-01' }
  ]
};

const contributions: Array<{ id: string; goalId: string; userId: number; amount: number; date: string; note: string | null }> = [
  { id: '1', goalId: '1', userId: 1, amount: 500000, date: '2026-05-01', note: 'First contribution' }
];

let idCounters = { accounts: 3, categories: 4, transactions: 3, budgets: 2, goals: 2, plans: 2, notifications: 2, contributions: 2 };

function generateId(type: keyof typeof idCounters): string {
  return String(idCounters[type]++);
}

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

function matchRoute(pattern: string, url: string): Record<string, string> | null {
  const patternParts = pattern.split('/');
  const urlParts = url.split('?')[0].split('/');
  
  if (patternParts.length !== urlParts.length) return null;
  
  const params: Record<string, string> = {};
  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i].startsWith(':')) {
      params[patternParts[i].slice(1)] = urlParts[i];
    } else if (patternParts[i] !== urlParts[i]) {
      return null;
    }
  }
  return params;
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

  // Health check
  if (url === '/api/health' && method === 'GET') {
    vercelRes.status(200).send(JSON.stringify({ status: 'ok' }));
    return;
  }

  // Auth endpoints (no token needed)
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
    const newUser = { id: users.length + 1, email, password, name: name || email.split('@')[0] };
    users.push(newUser);
    const token = simpleToken(newUser.id, newUser.email);
    vercelRes.status(201).send(JSON.stringify({ token, user: { id: newUser.id, email: newUser.email, name: newUser.name } }));
    return;
  }

  if (url === '/api/auth/me' && method === 'GET') {
    if (!token) {
      vercelRes.status(401).send(JSON.stringify({ message: 'Unauthorized' }));
      return;
    }
    const user = users.find(u => u.id === token.userId);
    if (!user) {
      vercelRes.status(404).send(JSON.stringify({ message: 'User not found' }));
      return;
    }
    vercelRes.status(200).send(JSON.stringify({ id: user.id, email: user.email, name: user.name }));
    return;
  }

  if (url === '/api/auth/change-password' && method === 'PUT') {
    const { currentPassword, newPassword } = (vercelReq.body as { currentPassword?: string; newPassword?: string }) || {};
    if (!currentPassword || !newPassword) {
      vercelRes.status(400).send(JSON.stringify({ message: 'currentPassword and newPassword required' }));
      return;
    }
    const user = users.find(u => u.id === token?.userId);
    if (!user || user.password !== currentPassword) {
      vercelRes.status(401).send(JSON.stringify({ message: 'Current password is incorrect' }));
      return;
    }
    user.password = newPassword;
    vercelRes.status(200).send(JSON.stringify({ message: 'Password updated successfully' }));
    return;
  }

  // All other endpoints require authentication
  if (!token) {
    vercelRes.status(401).send(JSON.stringify({ message: 'Unauthorized' }));
    return;
  }

  // User endpoint
  if (url === '/api/user' && method === 'GET') {
    const user = users.find(u => u.id === token.userId);
    if (!user) {
      vercelRes.status(404).send(JSON.stringify({ message: 'User not found' }));
      return;
    }
    vercelRes.status(200).send(JSON.stringify({ id: user.id, email: user.email, name: user.name }));
    return;
  }

  if (url === '/api/user' && method === 'PUT') {
    const { name } = (vercelReq.body as { name?: string }) || {};
    const user = users.find(u => u.id === token.userId);
    if (!user) {
      vercelRes.status(404).send(JSON.stringify({ message: 'User not found' }));
      return;
    }
    if (name) user.name = name;
    vercelRes.status(200).send(JSON.stringify({ id: user.id, email: user.email, name: user.name }));
    return;
  }

  // Account endpoints
  if (url === '/api/accounts' && method === 'GET') {
    const accounts = db.accounts.filter(a => a.userId === token.userId);
    vercelRes.status(200).send(JSON.stringify({ accounts }));
    return;
  }

  if (url === '/api/accounts' && method === 'POST') {
    const { name, type, balance, currency, icon, color } = (vercelReq.body as Record<string, unknown>) || {};
    if (!name || !type) {
      vercelRes.status(400).send(JSON.stringify({ message: 'Name and type required' }));
      return;
    }
    const newAccount = { 
      id: generateId('accounts'), 
      userId: token.userId, 
      name: String(name), 
      type: String(type), 
      balance: Number(balance) || 0, 
      currency: String(currency) || 'IDR',
      icon: String(icon) || 'wallet',
      color: String(color) || '#0EA5E9'
    };
    db.accounts.push(newAccount);
    vercelRes.status(201).send(JSON.stringify(newAccount));
    return;
  }

  if (url === '/api/accounts/balance/total' && method === 'GET') {
    const accounts = db.accounts.filter(a => a.userId === token.userId);
    const total = accounts.reduce((sum, a) => sum + a.balance, 0);
    vercelRes.status(200).send(JSON.stringify({ total }));
    return;
  }

  if (url.match(/^\/api\/accounts\/[^/]+$/) && method === 'GET') {
    const id = url.split('/')[3];
    const account = db.accounts.find(a => a.id === id && a.userId === token.userId);
    if (!account) {
      vercelRes.status(404).send(JSON.stringify({ message: 'Account not found' }));
      return;
    }
    vercelRes.status(200).send(JSON.stringify(account));
    return;
  }

  if (url.match(/^\/api\/accounts\/[^/]+$/) && method === 'PUT') {
    const id = url.split('/')[3];
    const account = db.accounts.find(a => a.id === id && a.userId === token.userId);
    if (!account) {
      vercelRes.status(404).send(JSON.stringify({ message: 'Account not found' }));
      return;
    }
    const updates = (vercelReq.body as Record<string, unknown>) || {};
    Object.assign(account, updates);
    vercelRes.status(200).send(JSON.stringify(account));
    return;
  }

  if (url.match(/^\/api\/accounts\/[^/]+$/) && method === 'DELETE') {
    const id = url.split('/')[3];
    const index = db.accounts.findIndex(a => a.id === id && a.userId === token.userId);
    if (index === -1) {
      vercelRes.status(404).send(JSON.stringify({ message: 'Account not found' }));
      return;
    }
    db.accounts.splice(index, 1);
    vercelRes.status(204).send('');
    return;
  }

  // Category endpoints
  if (url === '/api/categories' && method === 'GET') {
    const categories = db.categories.filter(c => c.userId === token.userId);
    vercelRes.status(200).send(JSON.stringify({ categories }));
    return;
  }

  if (url === '/api/categories' && method === 'POST') {
    const { name, type, icon, color } = (vercelReq.body as Record<string, unknown>) || {};
    if (!name || !type) {
      vercelRes.status(400).send(JSON.stringify({ message: 'Name and type required' }));
      return;
    }
    const newCategory = { 
      id: generateId('categories'), 
      userId: token.userId, 
      name: String(name), 
      type: String(type),
      icon: String(icon) || 'tag',
      color: String(color) || '#8B5CF6'
    };
    db.categories.push(newCategory);
    vercelRes.status(201).send(JSON.stringify(newCategory));
    return;
  }

  if (url.match(/^\/api\/categories\/[^/]+$/) && method === 'GET') {
    const id = url.split('/')[3];
    const category = db.categories.find(c => c.id === id && c.userId === token.userId);
    if (!category) {
      vercelRes.status(404).send(JSON.stringify({ message: 'Category not found' }));
      return;
    }
    vercelRes.status(200).send(JSON.stringify(category));
    return;
  }

  if (url.match(/^\/api\/categories\/[^/]+$/) && method === 'PUT') {
    const id = url.split('/')[3];
    const category = db.categories.find(c => c.id === id && c.userId === token.userId);
    if (!category) {
      vercelRes.status(404).send(JSON.stringify({ message: 'Category not found' }));
      return;
    }
    const updates = (vercelReq.body as Record<string, unknown>) || {};
    Object.assign(category, updates);
    vercelRes.status(200).send(JSON.stringify(category));
    return;
  }

  if (url.match(/^\/api\/categories\/[^/]+$/) && method === 'DELETE') {
    const id = url.split('/')[3];
    const index = db.categories.findIndex(c => c.id === id && c.userId === token.userId);
    if (index === -1) {
      vercelRes.status(404).send(JSON.stringify({ message: 'Category not found' }));
      return;
    }
    db.categories.splice(index, 1);
    vercelRes.status(204).send('');
    return;
  }

  // Transaction endpoints
  if (url === '/api/transactions' && method === 'GET') {
    const transactions = db.transactions.filter(t => t.userId === token.userId);
    vercelRes.status(200).send(JSON.stringify({ transactions }));
    return;
  }

  if (url === '/api/transactions/recent' && method === 'GET') {
    const transactions = db.transactions.filter(t => t.userId === token.userId).slice(0, 5);
    vercelRes.status(200).send(JSON.stringify({ transactions }));
    return;
  }

  if (url === '/api/transactions/summary' && method === 'GET') {
    const transactions = db.transactions.filter(t => t.userId === token.userId);
    const income = transactions.filter(t => t.type === 'INCOME').reduce((sum, t) => sum + t.amount, 0);
    const expense = transactions.filter(t => t.type === 'EXPENSE').reduce((sum, t) => sum + Math.abs(t.amount), 0);
    vercelRes.status(200).send(JSON.stringify({ income, expense, balance: income - expense }));
    return;
  }

  if (url === '/api/transactions' && method === 'POST') {
    const { accountId, categoryId, type, amount, description, date } = (vercelReq.body as Record<string, unknown>) || {};
    if (!accountId || !type || amount === undefined || !description) {
      vercelRes.status(400).send(JSON.stringify({ message: 'accountId, type, amount, description required' }));
      return;
    }
    const newTransaction = { 
      id: generateId('transactions'), 
      userId: token.userId, 
      accountId: String(accountId),
      categoryId: String(categoryId) || '',
      type: String(type),
      amount: Number(amount),
      description: String(description),
      date: String(date) || new Date().toISOString().split('T')[0]
    };
    db.transactions.push(newTransaction);
    vercelRes.status(201).send(JSON.stringify(newTransaction));
    return;
  }

  if (url.match(/^\/api\/transactions\/[^/]+$/) && method === 'GET') {
    const id = url.split('/')[3];
    const transaction = db.transactions.find(t => t.id === id && t.userId === token.userId);
    if (!transaction) {
      vercelRes.status(404).send(JSON.stringify({ message: 'Transaction not found' }));
      return;
    }
    vercelRes.status(200).send(JSON.stringify(transaction));
    return;
  }

  if (url.match(/^\/api\/transactions\/[^/]+$/) && method === 'PUT') {
    const id = url.split('/')[3];
    const transaction = db.transactions.find(t => t.id === id && t.userId === token.userId);
    if (!transaction) {
      vercelRes.status(404).send(JSON.stringify({ message: 'Transaction not found' }));
      return;
    }
    const updates = (vercelReq.body as Record<string, unknown>) || {};
    Object.assign(transaction, updates);
    vercelRes.status(200).send(JSON.stringify(transaction));
    return;
  }

  if (url.match(/^\/api\/transactions\/[^/]+$/) && method === 'DELETE') {
    const id = url.split('/')[3];
    const index = db.transactions.findIndex(t => t.id === id && t.userId === token.userId);
    if (index === -1) {
      vercelRes.status(404).send(JSON.stringify({ message: 'Transaction not found' }));
      return;
    }
    db.transactions.splice(index, 1);
    vercelRes.status(204).send('');
    return;
  }

  // Budget endpoints
  if (url === '/api/budgets' && method === 'GET') {
    const budgets = db.budgets.filter(b => b.userId === token.userId);
    vercelRes.status(200).send(JSON.stringify({ budgets }));
    return;
  }

  if (url === '/api/budgets/summary' && method === 'GET') {
    const budgets = db.budgets.filter(b => b.userId === token.userId);
    vercelRes.status(200).send(JSON.stringify({ totalBudget: budgets.reduce((sum, b) => sum + b.amount, 0), totalSpent: budgets.reduce((sum, b) => sum + b.spent, 0) }));
    return;
  }

  if (url === '/api/budgets' && method === 'POST') {
    const { categoryId, amount, period, startDate, endDate } = (vercelReq.body as Record<string, unknown>) || {};
    if (!categoryId || !amount) {
      vercelRes.status(400).send(JSON.stringify({ message: 'categoryId and amount required' }));
      return;
    }
    const newBudget = { 
      id: generateId('budgets'), 
      userId: token.userId, 
      categoryId: String(categoryId),
      amount: Number(amount),
      spent: 0,
      period: String(period) || 'monthly',
      startDate: String(startDate) || new Date().toISOString().split('T')[0],
      endDate: String(endDate) || '2026-05-31'
    };
    db.budgets.push(newBudget);
    vercelRes.status(201).send(JSON.stringify(newBudget));
    return;
  }

  if (url.match(/^\/api\/budgets\/[^/]+$/) && method === 'GET') {
    const id = url.split('/')[3];
    const budget = db.budgets.find(b => b.id === id && b.userId === token.userId);
    if (!budget) {
      vercelRes.status(404).send(JSON.stringify({ message: 'Budget not found' }));
      return;
    }
    vercelRes.status(200).send(JSON.stringify(budget));
    return;
  }

  if (url.match(/^\/api\/budgets\/[^/]+\/spent$/) && method === 'PUT') {
    const id = url.split('/')[3];
    const budget = db.budgets.find(b => b.id === id && b.userId === token.userId);
    if (!budget) {
      vercelRes.status(404).send(JSON.stringify({ message: 'Budget not found' }));
      return;
    }
    const { spent } = (vercelReq.body as { spent?: number }) || {};
    if (spent !== undefined) budget.spent = spent;
    vercelRes.status(200).send(JSON.stringify(budget));
    return;
  }

  if (url.match(/^\/api\/budgets\/[^/]+$/) && method === 'PUT') {
    const id = url.split('/')[3];
    const budget = db.budgets.find(b => b.id === id && b.userId === token.userId);
    if (!budget) {
      vercelRes.status(404).send(JSON.stringify({ message: 'Budget not found' }));
      return;
    }
    const updates = (vercelReq.body as Record<string, unknown>) || {};
    Object.assign(budget, updates);
    vercelRes.status(200).send(JSON.stringify(budget));
    return;
  }

  if (url.match(/^\/api\/budgets\/[^/]+$/) && method === 'DELETE') {
    const id = url.split('/')[3];
    const index = db.budgets.findIndex(b => b.id === id && b.userId === token.userId);
    if (index === -1) {
      vercelRes.status(404).send(JSON.stringify({ message: 'Budget not found' }));
      return;
    }
    db.budgets.splice(index, 1);
    vercelRes.status(204).send('');
    return;
  }

  // Goal endpoints
  if (url === '/api/goals' && method === 'GET') {
    const goals = db.goals.filter(g => g.userId === token.userId);
    vercelRes.status(200).send(JSON.stringify({ goals }));
    return;
  }

  if (url === '/api/goals/overview' && method === 'GET') {
    const goals = db.goals.filter(g => g.userId === token.userId);
    const totalTarget = goals.reduce((sum, g) => sum + g.targetAmount, 0);
    const totalSaved = goals.reduce((sum, g) => sum + g.currentAmount, 0);
    vercelRes.status(200).send(JSON.stringify({ totalTarget, totalSaved, progress: totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0 }));
    return;
  }

  if (url === '/api/goals' && method === 'POST') {
    const { name, targetAmount, deadline, icon, color } = (vercelReq.body as Record<string, unknown>) || {};
    if (!name || !targetAmount || !deadline) {
      vercelRes.status(400).send(JSON.stringify({ message: 'name, targetAmount, deadline required' }));
      return;
    }
    const newGoal = { 
      id: generateId('goals'), 
      userId: token.userId, 
      name: String(name),
      targetAmount: Number(targetAmount),
      currentAmount: 0,
      deadline: String(deadline),
      icon: String(icon) || 'target',
      color: String(color) || '#10B981',
      locked: false
    };
    db.goals.push(newGoal);
    vercelRes.status(201).send(JSON.stringify(newGoal));
    return;
  }

  if (url.match(/^\/api\/goals\/[^/]+$/) && method === 'GET') {
    const id = url.split('/')[3];
    const goal = db.goals.find(g => g.id === id && g.userId === token.userId);
    if (!goal) {
      vercelRes.status(404).send(JSON.stringify({ message: 'Goal not found' }));
      return;
    }
    vercelRes.status(200).send(JSON.stringify(goal));
    return;
  }

  if (url.match(/^\/api\/goals\/[^/]+$/) && method === 'PUT') {
    const id = url.split('/')[3];
    const goal = db.goals.find(g => g.id === id && g.userId === token.userId);
    if (!goal) {
      vercelRes.status(404).send(JSON.stringify({ message: 'Goal not found' }));
      return;
    }
    const updates = (vercelReq.body as Record<string, unknown>) || {};
    Object.assign(goal, updates);
    vercelRes.status(200).send(JSON.stringify(goal));
    return;
  }

  if (url.match(/^\/api\/goals\/[^/]+$/) && method === 'DELETE') {
    const id = url.split('/')[3];
    const index = db.goals.findIndex(g => g.id === id && g.userId === token.userId);
    if (index === -1) {
      vercelRes.status(404).send(JSON.stringify({ message: 'Goal not found' }));
      return;
    }
    db.goals.splice(index, 1);
    vercelRes.status(204).send('');
    return;
  }

  if (url.match(/^\/api\/goals\/[^/]+\/contributions$/) && method === 'POST') {
    const id = url.split('/')[3];
    const goal = db.goals.find(g => g.id === id && g.userId === token.userId);
    if (!goal) {
      vercelRes.status(404).send(JSON.stringify({ message: 'Goal not found' }));
      return;
    }
    const { amount } = (vercelReq.body as { amount?: number }) || {};
    if (amount) goal.currentAmount += amount;
    vercelRes.status(200).send(JSON.stringify(goal));
    return;
  }

  if (url.match(/^\/api\/goals\/[^/]+\/lock$/) && method === 'PATCH') {
    const id = url.split('/')[3];
    const goal = db.goals.find(g => g.id === id && g.userId === token.userId);
    if (!goal) {
      vercelRes.status(404).send(JSON.stringify({ message: 'Goal not found' }));
      return;
    }
    goal.locked = !goal.locked;
    vercelRes.status(200).send(JSON.stringify(goal));
    return;
  }

  if (url.match(/^\/api\/goals\/[^/]+\/contributions$/) && method === 'GET') {
    const id = url.split('/')[3];
    const goalContributions = contributions.filter(c => c.goalId === id && c.userId === token.userId);
    vercelRes.status(200).send(JSON.stringify({ contributions: goalContributions }));
    return;
  }

  if (url.match(/^\/api\/goals\/[^/]+\/contributions\/with-account$/) && method === 'POST') {
    const id = url.split('/')[3];
    const { amount, date, note, accountId, categoryId } = (vercelReq.body as { amount?: number; date?: string; note?: string; accountId?: string; categoryId?: string }) || {};
    if (!amount || !date) {
      vercelRes.status(400).send(JSON.stringify({ message: 'amount and date required' }));
      return;
    }
    const goal = db.goals.find(g => g.id === id && g.userId === token.userId);
    if (!goal) {
      vercelRes.status(404).send(JSON.stringify({ message: 'Goal not found' }));
      return;
    }
    const newContribution = { id: String(idCounters.contributions++), goalId: id, userId: token.userId, amount, date, note: note || null };
    contributions.push(newContribution);
    goal.currentAmount += amount;
    vercelRes.status(201).send(JSON.stringify(newContribution));
    return;
  }

  if (url.match(/^\/api\/goals\/from-milestone\/[^/]+$/) && method === 'POST') {
    const milestoneId = url.split('/')[4];
    const plan = db.plans.find(p => p.userId === token.userId);
    if (!plan || !(plan as { milestones?: unknown[] }).milestones) {
      vercelRes.status(404).send(JSON.stringify({ message: 'Plan or milestone not found' }));
      return;
    }
    const milestones = (plan as { milestones: Array<{ id: string; title: string; targetAmount?: number; targetDate: string }> }).milestones;
    const milestone = milestones.find(m => m.id === milestoneId);
    if (!milestone) {
      vercelRes.status(404).send(JSON.stringify({ message: 'Milestone not found' }));
      return;
    }
    const newGoal = { 
      id: generateId('goals'), 
      userId: token.userId, 
      name: milestone.title,
      targetAmount: milestone.targetAmount || 1000000,
      currentAmount: 0,
      deadline: milestone.targetDate,
      icon: 'target',
      color: '#10B981',
      locked: false
    };
    db.goals.push(newGoal);
    vercelRes.status(201).send(JSON.stringify(newGoal));
    return;
  }

  if (url.match(/^\/api\/goals\/[^/]+\/with-transaction$/) && method === 'DELETE') {
    const id = url.split('/')[3];
    const { accountId } = (vercelReq.body as { accountId?: string }) || {};
    const index = db.goals.findIndex(g => g.id === id && g.userId === token.userId);
    if (index === -1) {
      vercelRes.status(404).send(JSON.stringify({ message: 'Goal not found' }));
      return;
    }
    const goal = db.goals[index];
    if (accountId) {
      const account = db.accounts.find(a => a.id === accountId && a.userId === token.userId);
      if (account) account.balance += goal.currentAmount;
    }
    db.goals.splice(index, 1);
    vercelRes.status(200).send(JSON.stringify({ message: 'Goal deleted successfully' }));
    return;
  }

  if (url.match(/^\/api\/goals\/[^/]+\/with-refund$/) && method === 'DELETE') {
    const id = url.split('/')[3];
    const index = db.goals.findIndex(g => g.id === id && g.userId === token.userId);
    if (index === -1) {
      vercelRes.status(404).send(JSON.stringify({ message: 'Goal not found' }));
      return;
    }
    db.goals.splice(index, 1);
    vercelRes.status(200).send(JSON.stringify({ message: 'Goal deleted with refund' }));
    return;
  }

  // Plan endpoints
  if (url === '/api/plans' && method === 'GET') {
    const plans = db.plans.filter(p => p.userId === token.userId);
    vercelRes.status(200).send(JSON.stringify({ plans }));
    return;
  }

  if (url === '/api/plans' && method === 'POST') {
    const { name, description, status } = (vercelReq.body as Record<string, unknown>) || {};
    if (!name) {
      vercelRes.status(400).send(JSON.stringify({ message: 'name required' }));
      return;
    }
    const newPlan = { 
      id: generateId('plans'), 
      userId: token.userId, 
      name: String(name),
      description: String(description) || '',
      status: String(status) || 'active',
      milestones: []
    };
    db.plans.push(newPlan);
    vercelRes.status(201).send(JSON.stringify(newPlan));
    return;
  }

  if (url.match(/^\/api\/plans\/[^/]+$/) && method === 'GET') {
    const id = url.split('/')[3];
    const plan = db.plans.find(p => p.id === id && p.userId === token.userId);
    if (!plan) {
      vercelRes.status(404).send(JSON.stringify({ message: 'Plan not found' }));
      return;
    }
    vercelRes.status(200).send(JSON.stringify(plan));
    return;
  }

  if (url.match(/^\/api\/plans\/[^/]+$/) && method === 'PUT') {
    const id = url.split('/')[3];
    const plan = db.plans.find(p => p.id === id && p.userId === token.userId);
    if (!plan) {
      vercelRes.status(404).send(JSON.stringify({ message: 'Plan not found' }));
      return;
    }
    const updates = (vercelReq.body as Record<string, unknown>) || {};
    Object.assign(plan, updates);
    vercelRes.status(200).send(JSON.stringify(plan));
    return;
  }

  if (url.match(/^\/api\/plans\/[^/]+$/) && method === 'DELETE') {
    const id = url.split('/')[3];
    const index = db.plans.findIndex(p => p.id === id && p.userId === token.userId);
    if (index === -1) {
      vercelRes.status(404).send(JSON.stringify({ message: 'Plan not found' }));
      return;
    }
    db.plans.splice(index, 1);
    vercelRes.status(204).send('');
    return;
  }

  if (url.match(/^\/api\/plans\/[^/]+\/milestones$/) && method === 'GET') {
    const planId = url.split('/')[3];
    const plan = db.plans.find(p => p.id === planId && p.userId === token.userId);
    if (!plan) {
      vercelRes.status(404).send(JSON.stringify({ message: 'Plan not found' }));
      return;
    }
    const milestones = (plan as { milestones?: unknown[] }).milestones || [];
    vercelRes.status(200).send(JSON.stringify({ milestones }));
    return;
  }

  if (url.match(/^\/api\/plans\/[^/]+\/milestones$/) && method === 'POST') {
    const planId = url.split('/')[3];
    const plan = db.plans.find(p => p.id === planId && p.userId === token.userId);
    if (!plan) {
      vercelRes.status(404).send(JSON.stringify({ message: 'Plan not found' }));
      return;
    }
    const { title, description, targetDate, targetAmount } = (vercelReq.body as { title?: string; description?: string; targetDate?: string; targetAmount?: number }) || {};
    if (!title || !targetDate) {
      vercelRes.status(400).send(JSON.stringify({ message: 'title and targetDate required' }));
      return;
    }
    if (!(plan as { milestones?: unknown[] }).milestones) (plan as { milestones: unknown[] }).milestones = [];
    const milestones = plan as { milestones: Array<{ id: string; title: string; description: string; targetDate: string; targetAmount: number; goalId: string | null; isCompleted: boolean; completedAt: string | null; order: number }> };
    const newMilestone = { 
      id: String(milestones.milestones.length + 1), 
      title, 
      description: description || '', 
      targetDate, 
      targetAmount: targetAmount || 0, 
      goalId: null, 
      isCompleted: false, 
      completedAt: null, 
      order: milestones.milestones.length 
    };
    milestones.milestones.push(newMilestone);
    vercelRes.status(201).send(JSON.stringify(newMilestone));
    return;
  }

  if (url.match(/^\/api\/plans\/[^/]+\/milestones\/reorder$/) && method === 'PUT') {
    const planId = url.split('/')[3];
    const plan = db.plans.find(p => p.id === planId && p.userId === token.userId);
    if (!plan) {
      vercelRes.status(404).send(JSON.stringify({ message: 'Plan not found' }));
      return;
    }
    const { milestones: reorderMilestones } = (vercelReq.body as { milestones?: Array<{ id: string; order: number }> }) || {};
    if (!reorderMilestones) {
      vercelRes.status(400).send(JSON.stringify({ message: 'milestones array required' }));
      return;
    }
    if (!(plan as { milestones?: unknown[] }).milestones) (plan as { milestones: unknown[] }).milestones = [];
    const milestones = plan as { milestones: Array<{ id: string; order: number }> };
    reorderMilestones.forEach(m => {
      const existing = milestones.milestones.find(milestone => milestone.id === m.id);
      if (existing) existing.order = m.order;
    });
    vercelRes.status(200).send(JSON.stringify(plan));
    return;
  }

  if (url.match(/^\/api\/plans\/[^/]+\/milestones\/[^/]+$/) && method === 'PUT') {
    const planId = url.split('/')[3];
    const milestoneId = url.split('/')[5];
    const plan = db.plans.find(p => p.id === planId && p.userId === token.userId);
    if (!plan || !(plan as { milestones?: unknown[] }).milestones) {
      vercelRes.status(404).send(JSON.stringify({ message: 'Plan or milestone not found' }));
      return;
    }
    const milestones = plan as { milestones: Array<{ id: string }> };
    const milestone = milestones.milestones.find(m => m.id === milestoneId);
    if (!milestone) {
      vercelRes.status(404).send(JSON.stringify({ message: 'Milestone not found' }));
      return;
    }
    const updates = (vercelReq.body as Record<string, unknown>) || {};
    Object.assign(milestone, updates);
    vercelRes.status(200).send(JSON.stringify(milestone));
    return;
  }

  if (url.match(/^\/api\/plans\/[^/]+\/milestones\/[^/]+$/) && method === 'DELETE') {
    const planId = url.split('/')[3];
    const milestoneId = url.split('/')[5];
    const plan = db.plans.find(p => p.id === planId && p.userId === token.userId);
    if (!plan || !(plan as { milestones?: unknown[] }).milestones) {
      vercelRes.status(404).send(JSON.stringify({ message: 'Plan or milestone not found' }));
      return;
    }
    const milestones = plan as { milestones: Array<{ id: string }> };
    const index = milestones.milestones.findIndex(m => m.id === milestoneId);
    if (index === -1) {
      vercelRes.status(404).send(JSON.stringify({ message: 'Milestone not found' }));
      return;
    }
    milestones.milestones.splice(index, 1);
    vercelRes.status(204).send('');
    return;
  }

  if (url.match(/^\/api\/plans\/[^/]+\/milestones\/[^/]+\/complete$/) && method === 'PATCH') {
    const planId = url.split('/')[3];
    const milestoneId = url.split('/')[5];
    const plan = db.plans.find(p => p.id === planId && p.userId === token.userId);
    if (!plan || !(plan as { milestones?: unknown[] }).milestones) {
      vercelRes.status(404).send(JSON.stringify({ message: 'Plan or milestone not found' }));
      return;
    }
    const milestones = plan as { milestones: Array<{ id: string; isCompleted: boolean; completedAt: string }> };
    const milestone = milestones.milestones.find(m => m.id === milestoneId);
    if (!milestone) {
      vercelRes.status(404).send(JSON.stringify({ message: 'Milestone not found' }));
      return;
    }
    milestone.isCompleted = true;
    milestone.completedAt = new Date().toISOString();
    vercelRes.status(200).send(JSON.stringify(milestone));
    return;
  }

  if (url.match(/^\/api\/plans\/[^/]+\/link-budget$/) && method === 'GET') {
    const planId = url.split('/')[3];
    const plan = db.plans.find(p => p.id === planId && p.userId === token.userId);
    if (!plan) {
      vercelRes.status(404).send(JSON.stringify({ message: 'Plan not found' }));
      return;
    }
    const linkedBudgets = (plan as { linkedBudgets?: string[] }).linkedBudgets || [];
    vercelRes.status(200).send(JSON.stringify({ linkedBudgets }));
    return;
  }

  if (url.match(/^\/api\/plans\/[^/]+\/link-budget$/) && method === 'POST') {
    const planId = url.split('/')[3];
    const { budgetId } = (vercelReq.body as { budgetId?: string }) || {};
    const plan = db.plans.find(p => p.id === planId && p.userId === token.userId);
    if (!plan) {
      vercelRes.status(404).send(JSON.stringify({ message: 'Plan not found' }));
      return;
    }
    if (!(plan as { linkedBudgets?: string[] }).linkedBudgets) (plan as { linkedBudgets: string[] }).linkedBudgets = [];
    const linkedBudgets = plan as { linkedBudgets: string[] };
    if (budgetId && !linkedBudgets.linkedBudgets.includes(budgetId)) {
      linkedBudgets.linkedBudgets.push(budgetId);
    }
    vercelRes.status(200).send(JSON.stringify({ linkedBudgets: linkedBudgets.linkedBudgets }));
    return;
  }

  if (url.match(/^\/api\/plans\/[^/]+\/link-budget\/[^/]+$/) && method === 'DELETE') {
    const planId = url.split('/')[3];
    const budgetIdToRemove = url.split('/')[5];
    const plan = db.plans.find(p => p.id === planId && p.userId === token.userId);
    if (!plan || !(plan as { linkedBudgets?: string[] }).linkedBudgets) {
      vercelRes.status(404).send(JSON.stringify({ message: 'Plan not found' }));
      return;
    }
    const linkedBudgets = plan as { linkedBudgets: string[] };
    linkedBudgets.linkedBudgets = linkedBudgets.linkedBudgets.filter(id => id !== budgetIdToRemove);
    vercelRes.status(200).send(JSON.stringify({ linkedBudgets: linkedBudgets.linkedBudgets }));
    return;
  }

  if (url.match(/^\/api\/plans\/[^/]+\/link-goal$/) && method === 'GET') {
    const planId = url.split('/')[3];
    const plan = db.plans.find(p => p.id === planId && p.userId === token.userId);
    if (!plan) {
      vercelRes.status(404).send(JSON.stringify({ message: 'Plan not found' }));
      return;
    }
    const linkedGoals = (plan as { linkedGoals?: string[] }).linkedGoals || [];
    vercelRes.status(200).send(JSON.stringify({ linkedGoals }));
    return;
  }

  if (url.match(/^\/api\/plans\/[^/]+\/link-goal$/) && method === 'POST') {
    const planId = url.split('/')[3];
    const { goalId } = (vercelReq.body as { goalId?: string }) || {};
    const plan = db.plans.find(p => p.id === planId && p.userId === token.userId);
    if (!plan) {
      vercelRes.status(404).send(JSON.stringify({ message: 'Plan not found' }));
      return;
    }
    if (!(plan as { linkedGoals?: string[] }).linkedGoals) (plan as { linkedGoals: string[] }).linkedGoals = [];
    const linkedGoals = plan as { linkedGoals: string[] };
    if (goalId && !linkedGoals.linkedGoals.includes(goalId)) {
      linkedGoals.linkedGoals.push(goalId);
    }
    vercelRes.status(200).send(JSON.stringify({ linkedGoals: linkedGoals.linkedGoals }));
    return;
  }

  if (url.match(/^\/api\/plans\/[^/]+\/link-goal\/[^/]+$/) && method === 'DELETE') {
    const planId = url.split('/')[3];
    const goalIdToRemove = url.split('/')[5];
    const plan = db.plans.find(p => p.id === planId && p.userId === token.userId);
    if (!plan || !(plan as { linkedGoals?: string[] }).linkedGoals) {
      vercelRes.status(404).send(JSON.stringify({ message: 'Plan not found' }));
      return;
    }
    const linkedGoals = plan as { linkedGoals: string[] };
    linkedGoals.linkedGoals = linkedGoals.linkedGoals.filter(id => id !== goalIdToRemove);
    vercelRes.status(200).send(JSON.stringify({ linkedGoals: linkedGoals.linkedGoals }));
    return;
  }

  if (url.match(/^\/api\/plans\/[^/]+\/create-budgets-from-milestones$/) && method === 'POST') {
    const planId = url.split('/')[3];
    const plan = db.plans.find(p => p.id === planId && p.userId === token.userId);
    if (!plan || !(plan as { milestones?: unknown[] }).milestones || !(plan as { milestones: unknown[] }).milestones.length) {
      vercelRes.status(400).send(JSON.stringify({ message: 'No milestones found' }));
      return;
    }
    const milestones = plan as { milestones: Array<{ targetAmount: number; targetDate: string }> };
    const createdBudgets = [];
    for (const milestone of milestones.milestones) {
      if (milestone.targetAmount > 0) {
        const newBudget = {
          id: generateId('budgets'),
          userId: token.userId,
          categoryId: '1',
          amount: milestone.targetAmount,
          spent: 0,
          period: 'monthly',
          startDate: milestone.targetDate,
          endDate: milestone.targetDate
        };
        db.budgets.push(newBudget);
        createdBudgets.push(newBudget);
      }
    }
    vercelRes.status(201).send(JSON.stringify({ message: 'Budgets created successfully', budgets: createdBudgets }));
    return;
  }

  // Notification endpoints
  if (url === '/api/notifications' && method === 'GET') {
    const notifications = db.notifications.filter(n => n.userId === token.userId);
    vercelRes.status(200).send(JSON.stringify({ notifications }));
    return;
  }

  if (url === '/api/notifications/unread' && method === 'GET') {
    const notifications = db.notifications.filter(n => n.userId === token.userId && !n.read);
    vercelRes.status(200).send(JSON.stringify({ notifications }));
    return;
  }

  if (url === '/api/notifications/unread/count' && method === 'GET') {
    const count = db.notifications.filter(n => n.userId === token.userId && !n.read).length;
    vercelRes.status(200).send(JSON.stringify({ count }));
    return;
  }

  if (url.match(/^\/api\/notifications\/[^/]+\/read$/) && method === 'PATCH') {
    const id = url.split('/')[3];
    const notification = db.notifications.find(n => n.id === id && n.userId === token.userId);
    if (!notification) {
      vercelRes.status(404).send(JSON.stringify({ message: 'Notification not found' }));
      return;
    }
    notification.read = true;
    vercelRes.status(200).send(JSON.stringify(notification));
    return;
  }

  if (url === '/api/notifications/read-all' && method === 'PATCH') {
    db.notifications.filter(n => n.userId === token.userId).forEach(n => n.read = true);
    vercelRes.status(200).send(JSON.stringify({ success: true }));
    return;
  }

  if (url.match(/^\/api\/notifications\/[^/]+$/) && method === 'DELETE') {
    const id = url.split('/')[3];
    const index = db.notifications.findIndex(n => n.id === id && n.userId === token.userId);
    if (index === -1) {
      vercelRes.status(404).send(JSON.stringify({ message: 'Notification not found' }));
      return;
    }
    db.notifications.splice(index, 1);
    vercelRes.status(204).send('');
    return;
  }

  // AI endpoints (mock)
  if (url === '/api/ai/generate-plan' && method === 'POST') {
    vercelRes.status(200).send(JSON.stringify({ 
      plan: { name: 'AI Generated Plan', description: 'Based on your spending patterns' },
      milestones: [
        { name: 'Month 1', target: 1000000 },
        { name: 'Month 2', target: 2000000 },
        { name: 'Month 3', target: 3000000 }
      ]
    }));
    return;
  }

  if (url === '/api/ai/predict-spending' && method === 'POST') {
    vercelRes.status(200).send(JSON.stringify({ 
      predictedSpending: 2500000,
      categoryBreakdown: { food: 800000, transport: 500000, entertainment: 300000 }
    }));
    return;
  }

  if (url === '/api/ai/suggest-savings' && method === 'POST') {
    vercelRes.status(200).send(JSON.stringify({ 
      suggestions: [
        { category: 'Food', current: 1500000, suggested: 1200000, savings: 300000 },
        { category: 'Entertainment', current: 500000, suggested: 300000, savings: 200000 }
      ]
    }));
    return;
  }

  if (url === '/api/ai/ask' && method === 'POST') {
    const { question } = (vercelReq.body as { question?: string }) || {};
    if (!question) {
      vercelRes.status(400).send(JSON.stringify({ message: 'question required' }));
      return;
    }
    let answer = 'Based on your financial data, ';
    if (question.toLowerCase().includes('saving')) {
      answer += 'I recommend focusing on your emergency fund first. Consider allocating 20% of your income to savings.';
    } else if (question.toLowerCase().includes('budget')) {
      answer += 'Your budget looks balanced. The 50/30/20 rule suggests 50% needs, 30% wants, 20% savings.';
    } else if (question.toLowerCase().includes('invest')) {
      answer += 'For long-term investments, consider a diversified portfolio with index funds and some bonds.';
    } else {
      answer += 'keep up the good work with tracking your expenses. Consistency is key to financial health.';
    }
    vercelRes.status(200).send(JSON.stringify({ answer }));
    return;
  }

  if (url === '/api/ai/suggestions' && method === 'GET') {
    const suggestions = [
      { id: '1', type: 'BUDGET', title: 'Reduce Food Expenses', description: 'Your food spending is 15% above average. Consider meal planning.', potentialSavings: 300000, priority: 'HIGH', icon: 'utensils', actionLabel: 'Adjust Budget' },
      { id: '2', type: 'SAVINGS', title: 'Automate Savings', description: 'Set up automatic transfer to savings account on payday.', potentialSavings: 500000, priority: 'MEDIUM', icon: 'piggy-bank', actionLabel: 'Setup Auto-Save' },
      { id: '3', type: 'EXPENSE_REDUCTION', title: 'Cancel Unused Subscriptions', description: 'You have 2 streaming subscriptions that are rarely used.', potentialSavings: 150000, priority: 'LOW', icon: 'x-circle', actionLabel: 'Review Subscriptions' }
    ];
    vercelRes.status(200).send(JSON.stringify({ suggestions }));
    return;
  }

  if (url === '/api/ai/advice' && method === 'GET') {
    const accounts = db.accounts.filter(a => a.userId === token.userId);
    const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0);
    let advice = '';
    if (totalBalance < 1000000) {
      advice = 'Your total balance is low. Focus on building an emergency fund of 3-6 months of expenses before investing.';
    } else if (totalBalance < 10000000) {
      advice = 'Good financial position! Consider diversifying your accounts and starting to invest for long-term goals.';
    } else {
      advice = 'Excellent! You have a strong financial foundation. Focus on wealth preservation and strategic investments.';
    }
    vercelRes.status(200).send(JSON.stringify({ advice }));
    return;
  }

  if (url.match(/^\/api\/ai\/analyze-spending/) && method === 'GET') {
    const transactions = db.transactions.filter(t => t.userId === token.userId);
    const expenses = transactions.filter(t => t.type === 'EXPENSE');
    const totalExpense = expenses.reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const categoryTotals: Record<string, number> = {};
    expenses.forEach(t => {
      const cat = db.categories.find(c => c.id === t.categoryId);
      const name = cat?.name || 'Other';
      categoryTotals[name] = (categoryTotals[name] || 0) + Math.abs(t.amount);
    });
    const analysis = {
      totalSpending: totalExpense,
      categoryBreakdown: Object.entries(categoryTotals).map(([name, amount]) => ({ name, amount, percentage: Math.round((amount / totalExpense) * 100) })),
      averageDaily: Math.round(totalExpense / 30),
      trend: 'stable'
    };
    vercelRes.status(200).send(JSON.stringify({ analysis }));
    return;
  }

  if (url === '/api/ai/generate-plan-from-data' && method === 'POST') {
    const accounts = db.accounts.filter(a => a.userId === token.userId);
    const transactions = db.transactions.filter(t => t.userId === token.userId);
    const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0);
    const income = transactions.filter(t => t.type === 'INCOME').reduce((sum, t) => sum + t.amount, 0);
    const expenses = transactions.filter(t => t.type === 'EXPENSE').reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const generatedPlan = {
      name: 'AI Generated Financial Plan',
      description: 'Based on your spending patterns and current financial status',
      startDate: '2026-05-01',
      endDate: '2026-12-31',
      status: 'ACTIVE',
      milestones: [
        { id: '1', title: 'Build Emergency Fund', description: 'Save 3 months of expenses', targetDate: '2026-07-31', targetAmount: expenses * 3, isCompleted: false, order: 0 },
        { id: '2', title: 'Reduce High Interest Debt', description: 'Pay off credit cards', targetDate: '2026-09-30', targetAmount: 2000000, isCompleted: false, order: 1 },
        { id: '3', title: 'Start Investment Portfolio', description: 'Begin monthly investments', targetDate: '2026-12-31', targetAmount: 5000000, isCompleted: false, order: 2 }
      ]
    };
    const summary = {
      totalBalance: String(totalBalance),
      monthlyIncome: String(income),
      monthlyExpense: String(expenses),
      savings: String(income - expenses),
      topExpenses: [
        { category: 'Food', amount: 1500000 },
        { category: 'Transport', amount: 500000 }
      ]
    };
    vercelRes.status(200).send(JSON.stringify({ plan: generatedPlan, summary }));
    return;
  }

  // Report endpoint (mock)
  if (url === '/api/reports' && method === 'GET') {
    vercelRes.status(200).send(JSON.stringify({ 
      income: 5000000,
      expenses: 1500000,
      savings: 3500000,
      byCategory: []
    }));
    return;
  }

  if (url.match(/^\/api\/reports\/monthly/) && method === 'GET') {
    const urlParts = new URLSearchParams(url.split('?')[1]);
    const year = parseInt(urlParts.get('year') || '2026');
    const month = parseInt(urlParts.get('month') || '5');
    const transactions = db.transactions.filter(t => t.userId === token.userId);
    const income = transactions.filter(t => t.type === 'INCOME').reduce((sum, t) => sum + t.amount, 0);
    const expenses = transactions.filter(t => t.type === 'EXPENSE').reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const report = {
      period: { year, month, label: `${monthNames[month - 1]} ${year}` },
      summary: { totalIncome: income, totalExpense: expenses, balance: income - expenses },
      incomeByCategory: [
        { name: 'Salary', amount: income, color: '#10B981' }
      ],
      expenseByCategory: [
        { name: 'Food', amount: 1500000, color: '#F59E0B' },
        { name: 'Transport', amount: 500000, color: '#3B82F6' }
      ],
      transactions: transactions.slice(0, 50)
    };
    vercelRes.status(200).send(JSON.stringify({ report }));
    return;
  }

  if (url.match(/^\/api\/reports\/trends/) && method === 'GET') {
    const urlParts = new URLSearchParams(url.split('?')[1]);
    const months = parseInt(urlParts.get('months') || '6');
    const trends = [];
    for (let i = months - 1; i >= 0; i--) {
      const month = new Date(2026, 4 - i, 1);
      trends.push({
        month: month.toLocaleString('default', { month: 'short' }),
        year: month.getFullYear(),
        income: 5000000 + Math.floor(Math.random() * 500000),
        expense: 1500000 + Math.floor(Math.random() * 300000),
        balance: 3500000 + Math.floor(Math.random() * 200000)
      });
    }
    vercelRes.status(200).send(JSON.stringify({ trends }));
    return;
  }

  if (url.match(/^\/api\/reports\/category-breakdown/) && method === 'GET') {
    const transactions = db.transactions.filter(t => t.userId === token.userId && t.type === 'EXPENSE');
    const total = transactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const categoryTotals: Record<string, { amount: number; color: string }> = {};
    transactions.forEach(t => {
      const cat = db.categories.find(c => c.id === t.categoryId);
      const name = cat?.name || 'Other';
      if (!categoryTotals[name]) categoryTotals[name] = { amount: 0, color: cat?.color || '#888' };
      categoryTotals[name].amount += Math.abs(t.amount);
    });
    const categories = Object.entries(categoryTotals).map(([name, data]) => ({
      name,
      amount: data.amount,
      color: data.color,
      percentage: Math.round((data.amount / total) * 100)
    }));
    vercelRes.status(200).send(JSON.stringify({ total, categories }));
    return;
  }

  if (url === '/api/reports/net-worth' && method === 'GET') {
    const accounts = db.accounts.filter(a => a.userId === token.userId);
    const totalAssets = accounts.reduce((sum, a) => sum + a.balance, 0);
    const netWorth = {
      totalAssets,
      totalLiabilities: 0,
      investments: accounts.filter(a => a.type === 'INVESTMENT').reduce((sum, a) => sum + a.balance, 0),
      netWorth: totalAssets
    };
    vercelRes.status(200).send(JSON.stringify(netWorth));
    return;
  }

  if (url.match(/^\/api\/reports\/cash-flow/) && method === 'GET') {
    const transactions = db.transactions.filter(t => t.userId === token.userId);
    const dailyFlow: Record<string, { income: number; expense: number }> = {};
    transactions.forEach(t => {
      const date = t.date;
      if (!dailyFlow[date]) dailyFlow[date] = { income: 0, expense: 0 };
      if (t.type === 'INCOME') dailyFlow[date].income += t.amount;
      else dailyFlow[date].expense += Math.abs(t.amount);
    });
    const result = Object.entries(dailyFlow).map(([date, data]) => ({
      date,
      income: data.income,
      expense: data.expense,
      net: data.income - data.expense
    })).sort((a, b) => a.date.localeCompare(b.date));
    vercelRes.status(200).send(JSON.stringify({ dailyFlow: result }));
    return;
  }

  if (url.match(/^\/api\/reports\/export\/transactions/) && method === 'GET') {
    const transactions = db.transactions.filter(t => t.userId === token.userId);
    const headers = 'Date,Description,Amount,Type,Category\n';
    const rows = transactions.map(t => {
      const cat = db.categories.find(c => c.id === t.categoryId);
      return `${t.date},"${t.description}",${t.amount},${t.type},${cat?.name || 'Other'}`;
    }).join('\n');
    vercelRes.setHeader('Content-Type', 'text/csv');
    vercelRes.setHeader('Content-Disposition', 'attachment; filename=transactions-2026-05.csv');
    vercelRes.send(headers + rows);
    return;
  }

  // Notification delete endpoint
  if (url.match(/^\/api\/notifications\/[^/]+$/) && method === 'DELETE') {
    const id = url.split('/')[3];
    const index = db.notifications.findIndex(n => n.id === id && n.userId === token.userId);
    if (index === -1) {
      vercelRes.status(404).send(JSON.stringify({ message: 'Notification not found' }));
      return;
    }
    db.notifications.splice(index, 1);
    vercelRes.status(204).send('');
    return;
  }

  // 404 for unmatched routes
  vercelRes.status(404).send(JSON.stringify({ error: 'Not found', url, method }));
}