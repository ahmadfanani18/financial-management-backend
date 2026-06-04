import { getPrisma, parseBody, setupCors, parseToken } from './utils.js';

function calculateBudgetEndDate(startDate, period) {
  const start = new Date(startDate);
  switch (period) {
    case 'MONTHLY':
      return new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59);
    case 'WEEKLY': {
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      return end;
    }
    case 'YEARLY': {
      const end = new Date(start);
      end.setFullYear(end.getFullYear() + 1);
      end.setDate(end.getDate() - 1);
      end.setHours(23, 59, 59, 999);
      return end;
    }
    default:
      return start;
  }
}

function differenceInMonths(date1, date2) {
  return (date2.getFullYear() - date1.getFullYear()) * 12 + (date2.getMonth() - date1.getMonth());
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);
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

    // GET all goals
    if (url === '/api/goals' && method === 'GET') {
      const goals = await db.goal.findMany({
        where: { userId: token.userId },
        include: { contributions: true },
        orderBy: { createdAt: 'desc' },
      });
      const goalsWithProgress = goals.map(g => ({
        ...g,
        targetAmount: Number(g.targetAmount),
        currentAmount: Number(g.currentAmount),
        percentage: Number(g.targetAmount) > 0 ? Math.round((Number(g.currentAmount) / Number(g.targetAmount)) * 100) : 0,
        daysRemaining: Math.max(0, Math.ceil((new Date(g.deadline) - new Date()) / (1000 * 60 * 60 * 24))),
        isCompleted: Number(g.currentAmount) >= Number(g.targetAmount),
        isOverdue: new Date(g.deadline) < new Date() && Number(g.currentAmount) < Number(g.targetAmount),
      }));
      res.status(200).send(JSON.stringify({ goals: goalsWithProgress }));
      return;
    }

    // POST create goal
    if (url === '/api/goals' && method === 'POST') {
      const body = parseBody(req.body);
      const { createBudget, monthlyAmount, linkedAccountId, ...goalData } = body;
      
      let initialBalance = 0;
      if (linkedAccountId) {
        const account = await db.account.findFirst({ where: { id: linkedAccountId, userId: token.userId } });
        if (account) initialBalance = parseFloat(account.balance);
      }

      const goal = await db.goal.create({
        data: {
          userId: token.userId,
          name: goalData.name,
          targetAmount: goalData.targetAmount,
          deadline: goalData.deadline ? new Date(goalData.deadline) : new Date(),
          icon: goalData.icon || 'target',
          color: goalData.color || '#10B981',
          initialBalance,
          currentAmount: initialBalance,
          linkedAccountId: linkedAccountId || null,
        },
      });

      if (initialBalance > 0) {
        await db.goalContribution.create({
          data: {
            goalId: goal.id,
            amount: initialBalance,
            accountId: linkedAccountId,
            type: 'INITIAL',
            note: 'Saldo awal dari akun',
            date: new Date(),
          },
        });
      }

      if (createBudget && monthlyAmount && parseFloat(monthlyAmount) > 0) {
        const now = new Date();
        const deadline = new Date(goalData.deadline);
        const monthsRemaining = differenceInMonths(now, deadline);
        
        if (monthsRemaining > 0) {
          const categoryName = `Tabungan - ${goalData.name}`;
          let category = await db.category.findFirst({ where: { userId: token.userId, name: categoryName } });
          if (!category) {
            category = await db.category.create({
              data: {
                userId: token.userId,
                name: categoryName,
                type: 'EXPENSE',
                color: goalData.color || '#10B981',
                icon: goalData.icon || 'target',
              },
            });
          }
          
          const budgets = [];
          for (let i = 0; i <= monthsRemaining; i++) {
            budgets.push({
              userId: token.userId,
              categoryId: category.id,
              amount: parseFloat(monthlyAmount),
              period: 'MONTHLY',
              startDate: startOfMonth(new Date(now.getFullYear(), now.getMonth() + i, 1)),
              endDate: endOfMonth(new Date(now.getFullYear(), now.getMonth() + i, 1)),
              isActive: true,
              warningThreshold: 80,
            });
          }
          await db.budget.createMany({ data: budgets });
        }
      }

      if (linkedAccountId) {
        await db.account.update({
          where: { id: linkedAccountId },
          data: { linkedGoalId: goal.id },
        });
      }

      res.status(201).send(JSON.stringify({ goal }));
      return;
    }

    // GET goals overview
    if (url === '/api/goals/overview' && method === 'GET') {
      const goals = await db.goal.findMany({
        where: { userId: token.userId },
        select: { targetAmount: true, currentAmount: true },
      });
      const totalTarget = goals.reduce((sum, g) => sum + parseFloat(g.targetAmount), 0);
      const totalSaved = goals.reduce((sum, g) => sum + parseFloat(g.currentAmount), 0);
      res.status(200).send(JSON.stringify({
        totalTarget,
        totalSaved,
        progress: totalTarget > 0 ? Math.round((totalSaved / totalTarget) * 100) : 0,
      }));
      return;
    }

    // GET goal by ID
    const goalMatch = url.match(/^\/api\/goals\/([a-f0-9-]+)$/i);
    if (goalMatch && method === 'GET') {
      const goal = await db.goal.findFirst({
        where: { id: goalMatch[1], userId: token.userId },
        include: {
          contributions: { orderBy: { date: 'desc' } },
          linkedAccount: { select: { id: true, name: true, balance: true } },
        },
      });
      if (!goal) {
        res.status(404).send(JSON.stringify({ message: 'Target tabungan tidak ditemukan' }));
        return;
      }
      res.status(200).send(JSON.stringify({
        goal: {
          ...goal,
          targetAmount: Number(goal.targetAmount),
          currentAmount: Number(goal.currentAmount),
        },
      }));
      return;
    }

    // PUT update goal
    if (goalMatch && method === 'PUT') {
      const body = parseBody(req.body);
      const existing = await db.goal.findFirst({ where: { id: goalMatch[1], userId: token.userId } });
      if (!existing) {
        res.status(404).send(JSON.stringify({ message: 'Target tabungan tidak ditemukan' }));
        return;
      }
      if (existing.isLocked) {
        if (body.targetAmount || body.deadline || body.icon || body.color) {
          res.status(400).send(JSON.stringify({ message: 'Goal terkunci - hanya nama yang bisa diubah' }));
          return;
        }
      }
      const updateData = { ...body };
      if (body.deadline) updateData.deadline = new Date(body.deadline);
      const goal = await db.goal.update({ where: { id: goalMatch[1] }, data: updateData });
      res.status(200).send(JSON.stringify({ goal }));
      return;
    }

    // DELETE goal
    if (goalMatch && method === 'DELETE') {
      const existing = await db.goal.findFirst({ where: { id: goalMatch[1], userId: token.userId } });
      if (!existing) {
        res.status(404).send(JSON.stringify({ message: 'Target tabungan tidak ditemukan' }));
        return;
      }
      await db.goalContribution.deleteMany({ where: { goalId: goalMatch[1] } });
      await db.goal.delete({ where: { id: goalMatch[1] } });
      res.status(204).send(JSON.stringify({ message: 'Deleted' }));
      return;
    }

    // GET goal contributions
    const goalContributionsMatch = url.match(/^\/api\/goals\/([a-f0-9-]+)\/contributions$/i);
    if (goalContributionsMatch && method === 'GET') {
      const existing = await db.goal.findFirst({ where: { id: goalContributionsMatch[1], userId: token.userId } });
      if (!existing) {
        res.status(404).send(JSON.stringify({ message: 'Target tabungan tidak ditemukan' }));
        return;
      }
      const contributions = await db.goalContribution.findMany({
        where: { goalId: goalContributionsMatch[1] },
        orderBy: { date: 'desc' },
      });
      res.status(200).send(JSON.stringify({ contributions }));
      return;
    }

    // POST goal contribution
    if (goalContributionsMatch && method === 'POST') {
      const body = parseBody(req.body);
      const goalId = goalContributionsMatch[1];
      const existing = await db.goal.findFirst({ where: { id: goalId, userId: token.userId } });
      if (!existing) {
        res.status(404).send(JSON.stringify({ message: 'Target tabungan tidak ditemukan' }));
        return;
      }

      const amount = parseFloat(body.amount);
      
      await db.goalContribution.create({
        data: {
          goalId,
          amount,
          date: body.date ? new Date(body.date) : new Date(),
          note: body.note || null,
          accountId: body.accountId || null,
          categoryId: body.categoryId || null,
        },
      });

      const goal = await db.goal.update({
        where: { id: goalId },
        data: { currentAmount: { increment: amount } },
      });

      if (parseFloat(goal.currentAmount) >= parseFloat(goal.targetAmount) && goal.status === 'ACTIVE') {
        await db.goal.update({
          where: { id: goalId },
          data: { status: 'COMPLETED' },
        });
      }

      res.status(200).send(JSON.stringify({ goal }));
      return;
    }

    // DELETE contribution
    const deleteContributionMatch = url.match(/^\/api\/goals\/([a-f0-9-]+)\/contributions\/([a-f0-9-]+)$/i);
    if (deleteContributionMatch && method === 'DELETE') {
      const goalId = deleteContributionMatch[1];
      const contributionId = deleteContributionMatch[2];
      const existing = await db.goal.findFirst({ where: { id: goalId, userId: token.userId } });
      if (!existing) {
        res.status(404).send(JSON.stringify({ message: 'Target tabungan tidak ditemukan' }));
        return;
      }
      const contribution = await db.goalContribution.findFirst({
        where: { id: contributionId, goalId },
      });
      if (!contribution) {
        res.status(404).send(JSON.stringify({ message: 'Contribution tidak ditemukan' }));
        return;
      }
      if (contribution.type === 'INITIAL') {
        res.status(400).send(JSON.stringify({ message: 'Contribution awal tidak bisa dihapus' }));
        return;
      }

      await db.$transaction(async (tx) => {
        await tx.goal.update({
          where: { id: goalId },
          data: { currentAmount: { decrement: contribution.amount } },
        });
        if (contribution.accountId) {
          await tx.account.update({
            where: { id: contribution.accountId },
            data: { balance: { increment: contribution.amount } },
          });
        }
        if (contribution.sourceTransactionId) {
          await tx.transaction.delete({ where: { id: contribution.sourceTransactionId } });
        }
        await tx.goalContribution.delete({ where: { id: contributionId } });
      });

      res.status(204).send(JSON.stringify({ message: 'Deleted' }));
      return;
    }

    // PATCH goal lock toggle
    const goalLockMatch = url.match(/^\/api\/goals\/([a-f0-9-]+)\/lock$/i);
    if (goalLockMatch && method === 'PATCH') {
      const goalId = goalLockMatch[1];
      const existing = await db.goal.findFirst({ where: { id: goalId, userId: token.userId } });
      if (!existing) {
        res.status(404).send(JSON.stringify({ message: 'Target tabungan tidak ditemukan' }));
        return;
      }
      const updated = await db.goal.update({
        where: { id: goalId },
        data: { isLocked: !existing.isLocked },
      });
      res.status(200).send(JSON.stringify({ goal: updated }));
      return;
    }

    // DELETE goal with transaction
    const goalWithTransactionMatch = url.match(/^\/api\/goals\/([a-f0-9-]+)\/with-transaction$/i);
    if (goalWithTransactionMatch && method === 'DELETE') {
      const body = parseBody(req.body);
      const goalId = goalWithTransactionMatch[1];
      const existing = await db.goal.findFirst({ where: { id: goalId, userId: token.userId } });
      if (!existing) {
        res.status(404).send(JSON.stringify({ message: 'Target tabungan tidak ditemukan' }));
        return;
      }

      const totalContributions = (await db.goalContribution.findMany({ where: { goalId } }))
        .reduce((sum, c) => sum + parseFloat(c.amount), 0);

      if (totalContributions > 0 && body.accountId) {
        let category = await db.category.findFirst({
          where: { userId: token.userId, name: 'Goals', type: 'INCOME' },
        });
        if (!category) {
          category = await db.category.create({
            data: { userId: token.userId, name: 'Goals', type: 'INCOME', icon: 'target', color: '#10B981', isDefault: true },
          });
        }
        await db.transaction.create({
          data: {
            userId: token.userId,
            accountId: body.accountId,
            categoryId: category.id,
            type: 'INCOME',
            amount: totalContributions,
            description: `Pengembalian dana dari goal: ${existing.name}`,
            date: new Date(),
          },
        });
        await db.account.update({
          where: { id: body.accountId },
          data: { balance: { increment: totalContributions } },
        });
      }

      await db.goalContribution.deleteMany({ where: { goalId } });
      await db.goal.delete({ where: { id: goalId } });
      res.status(204).send(JSON.stringify({ message: 'Deleted' }));
      return;
    }

    res.status(404).send(JSON.stringify({ error: 'Not found', url, method }));
  } catch (err) {
    console.error('Goals handler error:', err);
    res.status(500).send(JSON.stringify({ message: 'Internal server error', error: String(err) }));
  } finally {
    if (db) {
      try { await db.$disconnect(); } catch {}
    }
  }
}