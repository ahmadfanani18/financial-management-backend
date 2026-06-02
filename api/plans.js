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
    const plans = await db.plan.findMany({ where: { userId: token.userId }, include: { milestones: true } });
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
        description: body.description,
        startDate: body.startDate ? new Date(body.startDate).toISOString() : new Date().toISOString(),
        endDate: body.endDate ? new Date(body.endDate).toISOString() : null,
        status: 'ACTIVE'
      }
    });
    res.status(201).send(JSON.stringify({ plan }));
    return;
  }

  // GET plan by ID
  const planMatch = url.match(/^\/api\/plans\/([a-f0-9-]+)$/i);
  if (planMatch && method === 'GET') {
    const plan = await db.plan.findFirst({ where: { id: planMatch[1], userId: token.userId }, include: { milestones: true } });
    if (!plan) {
      res.status(404).send(JSON.stringify({ message: 'Plan not found' }));
      return;
    }
    res.status(200).send(JSON.stringify({ plan }));
    return;
  }

  // PUT update plan
  if (planMatch && method === 'PUT') {
    const body = parseBody(req.body);
    const updateData = { ...body };
    if (body.startDate) updateData.startDate = new Date(body.startDate).toISOString();
    if (body.endDate === '') updateData.endDate = null;
    else if (body.endDate) updateData.endDate = new Date(body.endDate).toISOString();
    const plan = await db.plan.update({ where: { id: planMatch[1] }, data: updateData });
    res.status(200).send(JSON.stringify({ plan }));
    return;
  }

  // DELETE plan
  if (planMatch && method === 'DELETE') {
    await db.plan.delete({ where: { id: planMatch[1] } });
    res.status(204).send(JSON.stringify({ message: 'Deleted' }));
    return;
  }

  // GET plan milestones
  const planMilestonesMatch = url.match(/^\/api\/plans\/([a-f0-9-]+)\/milestones$/i);
  if (planMilestonesMatch && method === 'GET') {
    const milestones = await db.planMilestone.findMany({
      where: { planId: planMilestonesMatch[1] },
      orderBy: { order: 'asc' }
    });
    res.status(200).send(JSON.stringify({ milestones }));
    return;
  }

  // POST create milestone
  if (planMilestonesMatch && method === 'POST') {
    const body = parseBody(req.body);
    const planId = planMilestonesMatch[1];
    const existingMilestones = await db.planMilestone.findMany({ where: { planId } });
    const milestone = await db.planMilestone.create({
      data: {
        planId,
        title: body.title,
        description: body.description || null,
        targetDate: body.targetDate ? new Date(body.targetDate).toISOString() : null,
        targetAmount: body.targetAmount ? Number(body.targetAmount) : null,
        order: existingMilestones.length
      }
    });
    res.status(201).send(JSON.stringify({ milestone }));
    return;
  }

  // PUT update milestone
  const singleMilestone = url.match(/^\/api\/plans\/[a-f0-9-]+\/milestones\/[a-f0-9-]+$/i);
  if (singleMilestone && method === 'PUT') {
    const match = url.match(/^\/api\/plans\/([a-f0-9-]+)\/milestones\/([a-f0-9-]+)$/i);
    if (match) {
      const body = parseBody(req.body);
      const updateData = {};
      if (body.title) updateData.title = body.title;
      if (body.description !== undefined) updateData.description = body.description || null;
      if (body.targetDate) updateData.targetDate = new Date(body.targetDate).toISOString();
      if (body.targetAmount !== undefined) updateData.targetAmount = body.targetAmount ? Number(body.targetAmount) : null;
      if (body.goalId !== undefined) updateData.goalId = body.goalId || null;
      const milestone = await db.planMilestone.update({ where: { id: match[2] }, data: updateData });
      res.status(200).send(JSON.stringify({ milestone }));
      return;
    }
  }

  // PATCH complete milestone
  const completeMilestone = url.match(/^\/api\/plans\/[a-f0-9-]+\/milestones\/[a-f0-9-]+\/complete$/i);
  if (completeMilestone && method === 'PATCH') {
    const match = url.match(/^\/api\/plans\/([a-f0-9-]+)\/milestones\/([a-f0-9-]+)\/complete$/i);
    if (match) {
      const milestone = await db.planMilestone.update({ where: { id: match[2] }, data: { isCompleted: true, completedAt: new Date().toISOString() } });
      res.status(200).send(JSON.stringify({ milestone }));
      return;
    }
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