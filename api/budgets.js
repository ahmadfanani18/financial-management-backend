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

  // GET all budgets
  if (url === '/api/budgets' && method === 'GET') {
    const budgets = await db.budget.findMany({ where: { userId: token.userId }, include: { category: true } });
    const allExpenses = await db.transaction.groupBy({
      by: ['categoryId'],
      where: { userId: token.userId, type: 'EXPENSE' },
      _sum: { amount: true }
    });
    const expenseByCategory = Object.fromEntries(allExpenses.map(e => [e.categoryId, Math.abs(Number(e._sum.amount || 0))]));
    const budgetsWithSpent = budgets.map(b => {
      const spent = expenseByCategory[b.categoryId] || 0;
      return { ...b, spent, remaining: Number(b.amount) - spent, percentage: b.amount > 0 ? Math.round((spent / Number(b.amount)) * 100) : 0 };
    });
    res.status(200).send(JSON.stringify({ budgets: budgetsWithSpent }));
    return;
  }

  // POST create budget
  if (url === '/api/budgets' && method === 'POST') {
    const body = parseBody(req.body);
    const budget = await db.budget.create({
      data: {
        userId: token.userId,
        categoryId: body.categoryId,
        amount: body.amount,
        period: body.period || 'MONTHLY',
        startDate: body.startDate ? new Date(body.startDate).toISOString() : new Date().toISOString(),
        endDate: body.endDate ? new Date(body.endDate).toISOString() : null,
        warningThreshold: body.warningThreshold || 80,
        isActive: body.isActive !== false
      },
      include: { category: true }
    });
    res.status(201).send(JSON.stringify({ budget }));
    return;
  }

  // GET budgets summary
  if (url === '/api/budgets/summary' && method === 'GET') {
    const budgets = await db.budget.findMany({ where: { userId: token.userId } });
    const totalBudget = budgets.reduce((sum, b) => sum + Number(b.amount), 0);
    const allTransactions = await db.transaction.findMany({ where: { userId: token.userId, type: 'EXPENSE' } });
    const totalSpent = allTransactions.reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);
    res.status(200).send(JSON.stringify({ totalBudget, totalSpent, remaining: totalBudget - totalSpent, budgetCount: budgets.length }));
    return;
  }

  // GET budget by ID
  const budgetMatch = url.match(/^\/api\/budgets\/([a-f0-9-]+)$/i);
  if (budgetMatch && method === 'GET') {
    const budget = await db.budget.findFirst({ where: { id: budgetMatch[1], userId: token.userId }, include: { category: true } });
    if (!budget) {
      res.status(404).send(JSON.stringify({ message: 'Budget not found' }));
      return;
    }
    res.status(200).send(JSON.stringify({ budget }));
    return;
  }

  // PUT update budget
  if (budgetMatch && method === 'PUT') {
    const body = parseBody(req.body);
    const updateData = { ...body };
    if (body.startDate) updateData.startDate = new Date(body.startDate).toISOString();
    if (body.endDate === '') updateData.endDate = null;
    else if (body.endDate) updateData.endDate = new Date(body.endDate).toISOString();
    const budget = await db.budget.update({ where: { id: budgetMatch[1] }, data: updateData });
    res.status(200).send(JSON.stringify({ budget }));
    return;
  }

  // DELETE budget
  if (budgetMatch && method === 'DELETE') {
    await db.budget.delete({ where: { id: budgetMatch[1] } });
    res.status(204).send(JSON.stringify({ message: 'Deleted' }));
    return;
  }

  res.status(404).send(JSON.stringify({ error: 'Not found', url, method }));
}