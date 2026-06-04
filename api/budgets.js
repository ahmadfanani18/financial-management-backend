import { getPrisma, parseBody, setupCors, parseToken } from './utils.js';

function calculateEndDate(startDate, period) {
  const start = new Date(startDate);
  switch (period) {
    case 'MONTHLY':
      return new Date(start.getUTCFullYear(), start.getUTCMonth() + 1, 0, 23, 59, 59, 999);
    case 'WEEKLY': {
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      return end;
    }
    case 'YEARLY': {
      const end = new Date(start);
      end.setFullYear(end.getUTCFullYear() + 1);
      end.setDate(end.getDate() - 1);
      end.setHours(23, 59, 59, 999);
      return end;
    }
    default:
      return start;
  }
}

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

    // GET all budgets
    if (url === '/api/budgets' && method === 'GET') {
      const queryParams = new URLSearchParams(req.url.split('?')[1] || '');
      const month = queryParams.get('month');
      
      const budgets = await db.budget.findMany({
        where: { userId: token.userId },
        include: { category: true },
        orderBy: { createdAt: 'desc' }
      });
      
      let targetDate = new Date();
      if (month) {
        const [year, monthNum] = month.split('-');
        targetDate = new Date(parseInt(year), parseInt(monthNum) - 1, 15);
      }
      const targetYear = targetDate.getUTCFullYear();
      const targetMonth = targetDate.getUTCMonth();
      
      const filteredBudgets = budgets.filter((budget) => {
        const start = new Date(budget.startDate);
        const end = budget.endDate ? new Date(budget.endDate) : calculateEndDate(start, budget.period);
        const budgetStart = new Date(start.getUTCFullYear(), start.getUTCMonth(), 1);
        const budgetEnd = new Date(end.getUTCFullYear(), end.getUTCMonth(), 1);
        const target = new Date(targetYear, targetMonth, 1);
        return target >= budgetStart && target <= budgetEnd;
      });
      
      const results = await Promise.all(
        filteredBudgets.map(async (budget) => {
          const startDate = new Date(budget.startDate);
          const endDate = budget.endDate ? new Date(budget.endDate) : calculateEndDate(startDate, budget.period);
          
          const transactions = await db.transaction.findMany({
            where: {
              userId: token.userId,
              categoryId: budget.categoryId,
              type: { in: ['EXPENSE', 'TRANSFER'] },
              date: { gte: startDate, lte: endDate },
            },
          });
          
          const spent = transactions.reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);
          const percentage = Number(budget.amount) > 0 ? (spent / Number(budget.amount)) * 100 : 0;
          
          return {
            ...budget,
            spent,
            remaining: Number(budget.amount) - spent,
            percentage: Math.round(percentage),
            isOverBudget: spent > Number(budget.amount),
            isWarning: percentage >= budget.warningThreshold,
          };
        })
      );
      
      res.status(200).send(JSON.stringify({ budgets: results }));
      return;
    }

    // POST create budget
    if (url === '/api/budgets' && method === 'POST') {
      const body = parseBody(req.body);
      const startDate = body.startDate ? new Date(body.startDate) : new Date();
      const calculatedEndDate = calculateEndDate(startDate, body.period || 'MONTHLY');
      
      const budget = await db.budget.create({
        data: {
          userId: token.userId,
          categoryId: body.categoryId,
          amount: body.amount,
          period: body.period || 'MONTHLY',
          startDate: startDate.toISOString(),
          endDate: calculatedEndDate.toISOString(),
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
      const queryParams = new URLSearchParams(req.url.split('?')[1] || '');
      const month = queryParams.get('month');
      
      const budgets = await db.budget.findMany({
        where: { userId: token.userId },
        include: { category: true }
      });
      
      let targetDate = new Date();
      if (month) {
        const [year, monthNum] = month.split('-');
        targetDate = new Date(parseInt(year), parseInt(monthNum) - 1, 15);
      }
      const targetYear = targetDate.getUTCFullYear();
      const targetMonth = targetDate.getUTCMonth();
      
      const filteredBudgets = budgets.filter((budget) => {
        const start = new Date(budget.startDate);
        const end = budget.endDate ? new Date(budget.endDate) : calculateEndDate(start, budget.period);
        const budgetStart = new Date(start.getUTCFullYear(), start.getUTCMonth(), 1);
        const budgetEnd = new Date(end.getUTCFullYear(), end.getUTCMonth(), 1);
        const target = new Date(targetYear, targetMonth, 1);
        return target >= budgetStart && target <= budgetEnd;
      });
      
      let totalBudget = 0;
      let totalSpent = 0;
      
      for (const budget of filteredBudgets) {
        totalBudget += Number(budget.amount);
        
        const startDate = new Date(budget.startDate);
        const endDate = budget.endDate ? new Date(budget.endDate) : calculateEndDate(startDate, budget.period);
        
        const transactions = await db.transaction.findMany({
          where: {
            userId: token.userId,
            categoryId: budget.categoryId,
            type: { in: ['EXPENSE', 'TRANSFER'] },
            date: { gte: startDate, lte: endDate },
          },
        });
        
        totalSpent += transactions.reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);
      }
      
      res.status(200).send(JSON.stringify({
        totalBudget,
        totalSpent,
        remaining: totalBudget - totalSpent,
        budgetCount: filteredBudgets.length
      }));
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
      
      const startDate = new Date(budget.startDate);
      const endDate = budget.endDate ? new Date(budget.endDate) : calculateEndDate(startDate, budget.period);
      
      const transactions = await db.transaction.findMany({
        where: {
          userId: token.userId,
          categoryId: budget.categoryId,
          type: { in: ['EXPENSE', 'TRANSFER'] },
          date: { gte: startDate, lte: endDate },
        },
      });
      
      const spent = transactions.reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);
      const percentage = Number(budget.amount) > 0 ? (spent / Number(budget.amount)) * 100 : 0;
      
      res.status(200).send(JSON.stringify({
        budget: {
          ...budget,
          spent,
          remaining: Number(budget.amount) - spent,
          percentage: Math.round(percentage),
          isOverBudget: spent > Number(budget.amount),
          isWarning: percentage >= budget.warningThreshold,
        }
      }));
      return;
    }

    // PUT update budget
    if (budgetMatch && method === 'PUT') {
      const body = parseBody(req.body);
      const existing = await db.budget.findFirst({ where: { id: budgetMatch[1], userId: token.userId } });
      if (!existing) {
        res.status(404).send(JSON.stringify({ message: 'Budget not found' }));
        return;
      }
      
      let endDate = existing.endDate;
      if (body.startDate || body.period) {
        const newStartDate = body.startDate ? new Date(body.startDate) : new Date(existing.startDate);
        const newPeriod = body.period || existing.period;
        endDate = calculateEndDate(newStartDate, newPeriod).toISOString();
      }
      
      const updateData = { ...body };
      if (body.startDate) updateData.startDate = new Date(body.startDate).toISOString();
      if (endDate) updateData.endDate = endDate;
      if (body.endDate === '') updateData.endDate = null;
      
      const budget = await db.budget.update({ where: { id: budgetMatch[1] }, data: updateData, include: { category: true } });
      res.status(200).send(JSON.stringify({ budget }));
      return;
    }

    // PUT update spent
    const spentMatch = url.match(/^\/api\/budgets\/([a-f0-9-]+)\/spent$/i);
    if (spentMatch && method === 'PUT') {
      const body = parseBody(req.body);
      const existing = await db.budget.findFirst({ where: { id: spentMatch[1], userId: token.userId } });
      if (!existing) {
        res.status(404).send(JSON.stringify({ message: 'Budget not found' }));
        return;
      }
      const budget = await db.budget.update({
        where: { id: spentMatch[1] },
        data: { spent: body.spent },
        include: { category: true }
      });
      res.status(200).send(JSON.stringify({ budget }));
      return;
    }

    // DELETE budget
    if (budgetMatch && method === 'DELETE') {
      const existing = await db.budget.findFirst({ where: { id: budgetMatch[1], userId: token.userId } });
      if (!existing) {
        res.status(404).send(JSON.stringify({ message: 'Budget not found' }));
        return;
      }
      await db.budget.delete({ where: { id: budgetMatch[1] } });
      res.status(204).end();
      return;
    }

    res.status(404).send(JSON.stringify({ error: 'Not found', url, method }));
  } catch (err) {
    console.error('Budgets handler error:', err);
    res.status(500).send(JSON.stringify({ message: 'Internal server error', error: String(err) }));
  } finally {
    if (db) {
      try { await db.$disconnect(); } catch {}
    }
  }
}