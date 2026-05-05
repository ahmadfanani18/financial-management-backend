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

  // GET all goals
  if (url === '/api/goals' && method === 'GET') {
    const goals = await db.goal.findMany({ where: { userId: token.userId } });
    const goalsWithProgress = goals.map(g => ({
      ...g,
      percentage: Number(g.targetAmount) > 0 ? Math.round((Number(g.currentAmount) / Number(g.targetAmount)) * 100) : 0,
      daysRemaining: Math.ceil((new Date(g.deadline) - new Date()) / (1000 * 60 * 60 * 24)),
      isCompleted: Number(g.currentAmount) >= Number(g.targetAmount),
      isOverdue: new Date(g.deadline) < new Date() && Number(g.currentAmount) < Number(g.targetAmount)
    }));
    res.status(200).send(JSON.stringify({ goals: goalsWithProgress }));
    return;
  }

  // POST create goal
  if (url === '/api/goals' && method === 'POST') {
    const body = parseBody(req.body);
    const goal = await db.goal.create({
      data: {
        userId: token.userId,
        name: body.name,
        targetAmount: body.targetAmount,
        currentAmount: body.currentAmount || 0,
        deadline: body.deadline ? new Date(body.deadline).toISOString() : new Date().toISOString(),
        icon: body.icon || 'target',
        color: body.color || '#10B981',
        status: 'ACTIVE',
        isLocked: false
      }
    });
    res.status(201).send(JSON.stringify({ goal }));
    return;
  }

  // GET goals overview
  if (url === '/api/goals/overview' && method === 'GET') {
    const goals = await db.goal.findMany({ where: { userId: token.userId } });
    const totalTarget = goals.reduce((sum, g) => sum + Number(g.targetAmount), 0);
    const totalSaved = goals.reduce((sum, g) => sum + Number(g.currentAmount), 0);
    res.status(200).send(JSON.stringify({ totalTarget, totalSaved, progress: totalTarget > 0 ? Math.round((totalSaved / totalTarget) * 100) : 0 }));
    return;
  }

  // GET goal by ID
  const goalMatch = url.match(/^\/api\/goals\/([a-f0-9-]+)$/i);
  if (goalMatch && method === 'GET') {
    const goal = await db.goal.findFirst({ where: { id: goalMatch[1], userId: token.userId } });
    if (!goal) {
      res.status(404).send(JSON.stringify({ message: 'Goal not found' }));
      return;
    }
    res.status(200).send(JSON.stringify({ goal }));
    return;
  }

  // PUT update goal
  if (goalMatch && method === 'PUT') {
    const body = parseBody(req.body);
    const updateData = { ...body };
    if (body.deadline) updateData.deadline = new Date(body.deadline).toISOString();
    const goal = await db.goal.update({ where: { id: goalMatch[1] }, data: updateData });
    res.status(200).send(JSON.stringify({ goal }));
    return;
  }

  // DELETE goal
  if (goalMatch && method === 'DELETE') {
    await db.goal.delete({ where: { id: goalMatch[1] } });
    res.status(204).send(JSON.stringify({ message: 'Deleted' }));
    return;
  }

  // GET goal contributions
  const goalContributionsMatch = url.match(/^\/api\/goals\/([a-f0-9-]+)\/contributions$/i);
  if (goalContributionsMatch && method === 'GET') {
    const contributions = await db.goalContribution.findMany({
      where: { goalId: goalContributionsMatch[1] },
      orderBy: { createdAt: 'desc' }
    });
    res.status(200).send(JSON.stringify({ contributions }));
    return;
  }

  // POST goal contribution
  if (goalContributionsMatch && method === 'POST') {
    const body = parseBody(req.body);
    const goalId = goalContributionsMatch[1];
    await db.goalContribution.create({
      data: {
        goalId,
        amount: body.amount,
        date: body.date ? new Date(body.date).toISOString() : new Date().toISOString(),
        note: body.note || null,
        accountId: body.accountId || null,
        categoryId: body.categoryId || null
      }
    });
    const goal = await db.goal.update({
      where: { id: goalId },
      data: { currentAmount: { increment: body.amount } }
    });
    res.status(200).send(JSON.stringify({ goal }));
    return;
  }

  // PATCH goal lock toggle
  const goalLockMatch = url.match(/^\/api\/goals\/([a-f0-9-]+)\/lock$/i);
  if (goalLockMatch && method === 'PATCH') {
    const goalId = goalLockMatch[1];
    const goal = await db.goal.findFirst({ where: { id: goalId, userId: token.userId } });
    if (!goal) {
      res.status(404).send(JSON.stringify({ message: 'Goal not found' }));
      return;
    }
    const updated = await db.goal.update({
      where: { id: goalId },
      data: { isLocked: !goal.isLocked }
    });
    res.status(200).send(JSON.stringify({ goal: updated }));
    return;
  }

  // POST goal contribution with account
  const goalContribWithAccountMatch = url.match(/^\/api\/goals\/([a-f0-9-]+)\/contributions\/with-account$/i);
  if (goalContribWithAccountMatch && method === 'POST') {
    const body = parseBody(req.body);
    const goalId = goalContribWithAccountMatch[1];
    await db.goalContribution.create({
      data: {
        goalId,
        amount: body.amount,
        date: body.date ? new Date(body.date).toISOString() : new Date().toISOString(),
        note: body.note || null,
        accountId: body.accountId || null,
        categoryId: body.categoryId || null
      }
    });
    await db.goal.update({
      where: { id: goalId },
      data: { currentAmount: { increment: body.amount } }
    });
    await db.transaction.create({
      data: {
        userId: token.userId,
        accountId: body.accountId,
        categoryId: body.categoryId || null,
        type: 'EXPENSE',
        amount: body.amount,
        description: body.note || 'Goal contribution',
        date: body.date ? new Date(body.date).toISOString() : new Date().toISOString()
      }
    });
    const goal = await db.goal.findUnique({ where: { id: goalId } });
    res.status(200).send(JSON.stringify({ goal }));
    return;
  }

  // DELETE goal with transaction
  const goalWithTransactionMatch = url.match(/^\/api\/goals\/([a-f0-9-]+)\/with-transaction$/i);
  if (goalWithTransactionMatch && method === 'DELETE') {
    const body = parseBody(req.body);
    const goalId = goalWithTransactionMatch[1];
    const goal = await db.goal.findFirst({ where: { id: goalId, userId: token.userId } });
    if (!goal) {
      res.status(404).send(JSON.stringify({ message: 'Goal not found' }));
      return;
    }
    if (body.accountId && Number(goal.currentAmount) > 0) {
      await db.transaction.create({
        data: {
          userId: token.userId,
          accountId: body.accountId,
          type: 'INCOME',
          amount: goal.currentAmount,
          description: `Refund from goal: ${goal.name}`,
          date: new Date().toISOString()
        }
      });
    }
    await db.goal.delete({ where: { id: goalId } });
    res.status(204).send(JSON.stringify({ message: 'Deleted' }));
    return;
  }

  res.status(404).send(JSON.stringify({ error: 'Not found', url, method }));
}