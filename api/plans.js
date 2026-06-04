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

    // GET all plans
    if (url === '/api/plans' && method === 'GET') {
      const plans = await db.plan.findMany({
        where: { userId: token.userId },
        include: {
          milestones: { orderBy: { order: 'asc' }, include: { goal: true } },
          planBudgets: { include: { budget: { include: { category: true } } } },
          planGoals: { include: { goal: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
      res.status(200).send(JSON.stringify({ plans }));
      return;
    }

    // POST create plan
    if (url === '/api/plans' && method === 'POST') {
      const body = parseBody(req.body);
      const plan = await db.plan.create({
        data: {
          userId: token.userId,
          name: body.name,
          description: body.description || null,
          startDate: body.startDate ? new Date(body.startDate) : new Date(),
          endDate: body.endDate ? new Date(body.endDate) : null,
          status: 'ACTIVE',
        },
        include: { milestones: true },
      });
      res.status(201).send(JSON.stringify({ plan }));
      return;
    }

    // GET plan by ID
    const planMatch = url.match(/^\/api\/plans\/([a-f0-9-]+)$/i);
    if (planMatch && method === 'GET') {
      const plan = await db.plan.findFirst({
        where: { id: planMatch[1], userId: token.userId },
        include: {
          milestones: { orderBy: { order: 'asc' }, include: { goal: true } },
          planBudgets: { include: { budget: { include: { category: true } } } },
          planGoals: { include: { goal: true } },
        },
      });
      if (!plan) {
        res.status(404).send(JSON.stringify({ message: 'Rencana tidak ditemukan' }));
        return;
      }
      res.status(200).send(JSON.stringify({ plan }));
      return;
    }

    // PUT update plan
    if (planMatch && method === 'PUT') {
      const body = parseBody(req.body);
      const existing = await db.plan.findFirst({ where: { id: planMatch[1], userId: token.userId } });
      if (!existing) {
        res.status(404).send(JSON.stringify({ message: 'Rencana tidak ditemukan' }));
        return;
      }
      const updateData = { ...body };
      if (body.startDate) updateData.startDate = new Date(body.startDate);
      if (body.endDate === '') updateData.endDate = null;
      else if (body.endDate) updateData.endDate = new Date(body.endDate);
      const plan = await db.plan.update({
        where: { id: planMatch[1] },
        data: updateData,
        include: { milestones: { orderBy: { order: 'asc' } } },
      });
      res.status(200).send(JSON.stringify({ plan }));
      return;
    }

    // DELETE plan
    if (planMatch && method === 'DELETE') {
      const existing = await db.plan.findFirst({ where: { id: planMatch[1], userId: token.userId } });
      if (!existing) {
        res.status(404).send(JSON.stringify({ message: 'Rencana tidak ditemukan' }));
        return;
      }

      const milestones = await db.planMilestone.findMany({
        where: { planId: planMatch[1] },
        select: { goalId: true },
      });
      const goalIds = milestones.filter(m => m.goalId).map(m => m.goalId);

      if (goalIds.length > 0) {
        await db.goalContribution.deleteMany({ where: { goalId: { in: goalIds } } });
        await db.goal.deleteMany({ where: { id: { in: goalIds } } });
      }

      await db.planMilestone.deleteMany({ where: { planId: planMatch[1] } });
      await db.plan.delete({ where: { id: planMatch[1] } });
      res.status(204).end();
      return;
    }

    // GET plan milestones
    const planMilestonesMatch = url.match(/^\/api\/plans\/([a-f0-9-]+)\/milestones$/i);
    if (planMilestonesMatch && method === 'GET') {
      const plan = await db.plan.findFirst({ where: { id: planMilestonesMatch[1], userId: token.userId } });
      if (!plan) {
        res.status(404).send(JSON.stringify({ message: 'Rencana tidak ditemukan' }));
        return;
      }
      const milestones = await db.planMilestone.findMany({
        where: { planId: planMilestonesMatch[1] },
        orderBy: { order: 'asc' },
        include: { goal: true },
      });
      res.status(200).send(JSON.stringify({ milestones }));
      return;
    }

    // POST create milestone
    if (planMilestonesMatch && method === 'POST') {
      const body = parseBody(req.body);
      const plan = await db.plan.findFirst({ where: { id: planMilestonesMatch[1], userId: token.userId } });
      if (!plan) {
        res.status(404).send(JSON.stringify({ message: 'Rencana tidak ditemukan' }));
        return;
      }

      const lastMilestone = await db.planMilestone.findFirst({
        where: { planId: planMilestonesMatch[1] },
        orderBy: { order: 'desc' },
      });
      const order = lastMilestone ? lastMilestone.order + 1 : 0;

      const milestone = await db.planMilestone.create({
        data: {
          planId: planMilestonesMatch[1],
          title: body.title,
          description: body.description || null,
          targetDate: body.targetDate ? new Date(body.targetDate) : null,
          targetAmount: body.targetAmount ? parseFloat(body.targetAmount) : null,
          goalId: body.goalId || null,
          order,
        },
      });
      res.status(201).send(JSON.stringify({ milestone }));
      return;
    }

    // PUT update milestone
    const singleMilestone = url.match(/^\/api\/plans\/([a-f0-9-]+)\/milestones\/([a-f0-9-]+)$/i);
    if (singleMilestone && method === 'PUT') {
      const body = parseBody(req.body);
      const milestone = await db.planMilestone.findFirst({
        where: { id: singleMilestone[2], plan: { userId: token.userId } },
      });
      if (!milestone) {
        res.status(404).send(JSON.stringify({ message: 'Milestone tidak ditemukan' }));
        return;
      }
      const updateData = {};
      if (body.title) updateData.title = body.title;
      if (body.description !== undefined) updateData.description = body.description || null;
      if (body.targetDate) updateData.targetDate = new Date(body.targetDate);
      if (body.targetAmount !== undefined) updateData.targetAmount = body.targetAmount ? parseFloat(body.targetAmount) : null;
      if (body.goalId !== undefined) updateData.goalId = body.goalId || null;

      const updated = await db.planMilestone.update({
        where: { id: singleMilestone[2] },
        data: updateData,
      });
      res.status(200).send(JSON.stringify({ milestone: updated }));
      return;
    }

    // DELETE milestone
    if (singleMilestone && method === 'DELETE') {
      const milestone = await db.planMilestone.findFirst({
        where: { id: singleMilestone[2], plan: { userId: token.userId } },
      });
      if (!milestone) {
        res.status(404).send(JSON.stringify({ message: 'Milestone tidak ditemukan' }));
        return;
      }
      await db.planMilestone.delete({ where: { id: singleMilestone[2] } });
      res.status(204).end();
      return;
    }

    // PATCH complete milestone
    const completeMilestone = url.match(/^\/api\/plans\/([a-f0-9-]+)\/milestones\/([a-f0-9-]+)\/complete$/i);
    if (completeMilestone && method === 'PATCH') {
      const milestone = await db.planMilestone.findFirst({
        where: { id: completeMilestone[2], plan: { userId: token.userId } },
      });
      if (!milestone) {
        res.status(404).send(JSON.stringify({ message: 'Milestone tidak ditemukan' }));
        return;
      }
      const updated = await db.planMilestone.update({
        where: { id: completeMilestone[2] },
        data: { isCompleted: true, completedAt: new Date() },
      });
      res.status(200).send(JSON.stringify({ milestone: updated }));
      return;
    }

    // POST link budget
    const linkBudgetMatch = url.match(/^\/api\/plans\/([a-f0-9-]+)\/budgets\/([a-f0-9-]+)$/i);
    if (linkBudgetMatch && method === 'POST') {
      const plan = await db.plan.findFirst({ where: { id: linkBudgetMatch[1], userId: token.userId } });
      if (!plan) {
        res.status(404).send(JSON.stringify({ message: 'Rencana tidak ditemukan' }));
        return;
      }
      const budget = await db.budget.findFirst({ where: { id: linkBudgetMatch[2], userId: token.userId } });
      if (!budget) {
        res.status(404).send(JSON.stringify({ message: 'Anggaran tidak ditemukan' }));
        return;
      }
      const planBudget = await db.planBudget.create({
        data: { planId: linkBudgetMatch[1], budgetId: linkBudgetMatch[2] },
      });
      res.status(201).send(JSON.stringify({ planBudget }));
      return;
    }

    // DELETE unlink budget
    if (linkBudgetMatch && method === 'DELETE') {
      const plan = await db.plan.findFirst({ where: { id: linkBudgetMatch[1], userId: token.userId } });
      if (!plan) {
        res.status(404).send(JSON.stringify({ message: 'Rencana tidak ditemukan' }));
        return;
      }
      await db.planBudget.deleteMany({
        where: { planId: linkBudgetMatch[1], budgetId: linkBudgetMatch[2] },
      });
      res.status(204).end();
      return;
    }

    // POST link goal
    const linkGoalMatch = url.match(/^\/api\/plans\/([a-f0-9-]+)\/goals\/([a-f0-9-]+)$/i);
    if (linkGoalMatch && method === 'POST') {
      const plan = await db.plan.findFirst({ where: { id: linkGoalMatch[1], userId: token.userId } });
      if (!plan) {
        res.status(404).send(JSON.stringify({ message: 'Rencana tidak ditemukan' }));
        return;
      }
      const goal = await db.goal.findFirst({ where: { id: linkGoalMatch[2], userId: token.userId } });
      if (!goal) {
        res.status(404).send(JSON.stringify({ message: 'Target tabungan tidak ditemukan' }));
        return;
      }
      const planGoal = await db.planGoal.create({
        data: { planId: linkGoalMatch[1], goalId: linkGoalMatch[2] },
      });
      res.status(201).send(JSON.stringify({ planGoal }));
      return;
    }

    // DELETE unlink goal
    if (linkGoalMatch && method === 'DELETE') {
      const plan = await db.plan.findFirst({ where: { id: linkGoalMatch[1], userId: token.userId } });
      if (!plan) {
        res.status(404).send(JSON.stringify({ message: 'Rencana tidak ditemukan' }));
        return;
      }
      await db.planGoal.deleteMany({
        where: { planId: linkGoalMatch[1], goalId: linkGoalMatch[2] },
      });
      res.status(204).end();
      return;
    }

    res.status(404).send(JSON.stringify({ error: 'Not found', url, method }));
  } catch (err) {
    console.error('Plans handler error:', err);
    res.status(500).send(JSON.stringify({ message: 'Internal server error', error: String(err) }));
  } finally {
    if (db) {
      try { await db.$disconnect(); } catch {}
    }
  }
}