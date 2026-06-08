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
    const queryParams = new URL(req.url, 'http://localhost').searchParams;

    const token = parseToken(req.headers.authorization);
    if (!token && !url.includes('/auth/') && url !== '/api/health' && url !== '/api/pricing') {
      res.status(401).send(JSON.stringify({ message: 'Unauthorized' }));
      return;
    }

    db = await getPrisma();

    // GET all transactions
    if (url === '/api/transactions' && method === 'GET') {
      const where = { userId: token.userId };
      
      const accountId = queryParams.get('accountId');
      const categoryId = queryParams.get('categoryId');
      const type = queryParams.get('type');
      const startDate = queryParams.get('startDate');
      const endDate = queryParams.get('endDate');
      const minAmount = queryParams.get('minAmount');
      const maxAmount = queryParams.get('maxAmount');
      const search = queryParams.get('search');
      const page = parseInt(queryParams.get('page') || '1');
      const limit = parseInt(queryParams.get('limit') || '50');

      if (accountId) where.accountId = accountId;
      if (categoryId) where.categoryId = categoryId;
      if (type && ['INCOME', 'EXPENSE', 'TRANSFER'].includes(type)) where.type = type;
      if (startDate || endDate) {
        where.date = {};
        if (startDate) where.date.gte = new Date(startDate);
        if (endDate) where.date.lte = new Date(endDate);
      }
      if (minAmount || maxAmount) {
        where.amount = {};
        if (minAmount) where.amount.gte = parseFloat(minAmount);
        if (maxAmount) where.amount.lte = parseFloat(maxAmount);
      }
      if (search) where.description = { contains: search, mode: 'insensitive' };

      const skip = (page - 1) * limit;
      
      const [transactions, total] = await Promise.all([
        db.transaction.findMany({
          where,
          skip,
          take: limit,
          orderBy: { date: 'desc' },
          include: {
            account: true,
            category: true,
            fromAccount: true,
            toAccount: true,
            tags: { include: { tag: true } },
          },
        }),
        db.transaction.count({ where }),
      ]);

      const result = {
        transactions: transactions.map(t => ({
          ...t,
          tags: t.tags.map(t => t.tag),
        })),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
      res.status(200).send(JSON.stringify(result));
      return;
    }

    // POST create transaction
    if (url === '/api/transactions' && method === 'POST') {
      const body = parseBody(req.body);
      
      if (body.type === 'EXPENSE' && body.categoryId) {
        const budgets = await db.budget.findMany({
          where: { userId: token.userId, categoryId: body.categoryId, isActive: true },
        });
        if (budgets.length > 0) {
          const txDate = new Date(body.date);
          let validBudget = null;
          for (const budget of budgets) {
            const startDate = new Date(budget.startDate);
            const endDate = budget.endDate ? new Date(budget.endDate) : calculateBudgetEndDate(startDate, budget.period);
            if (txDate >= startDate && txDate <= endDate) {
              validBudget = budget;
              break;
            }
          }
          if (!validBudget) {
            const periods = budgets.map(b => {
              const s = new Date(b.startDate);
              const e = b.endDate ? new Date(b.endDate) : calculateBudgetEndDate(s, b.period);
              return `${s.toLocaleDateString('id-ID')} - ${e.toLocaleDateString('id-ID')}`;
            }).join(', ');
            res.status(400).send(JSON.stringify({ message: `Transaksi pada tanggal ${txDate.toLocaleDateString('id-ID')} tidak berada dalam periode budget aktif (${periods}).` }));
            return;
          }
        }
      }

      const adminFee = parseFloat(body.adminFee ?? 0);
      if (body.type === 'TRANSFER' && adminFee > parseFloat(body.amount)) {
        res.status(400).send(JSON.stringify({ message: 'Biaya admin tidak boleh lebih besar dari jumlah transfer' }));
        return;
      }

      const { tagIds, ...data } = body;
      const transactionData = {
        type: body.type,
        amount: body.amount,
        accountId: body.accountId,
        categoryId: body.categoryId || null,
        fromAccountId: body.fromAccountId || null,
        toAccountId: body.toAccountId || null,
        description: body.description || '',
        note: body.note,
        date: body.date ? new Date(body.date) : new Date(),
        receiptUrl: body.receiptUrl,
        isRecurring: body.isRecurring || false,
        recurringPattern: body.recurringPattern,
        userId: token.userId,
        adminFee,
      };

      const record = await db.transaction.create({ data: transactionData });

      if (tagIds?.length) {
        await db.transactionTag.createMany({
          data: tagIds.map(tagId => ({ transactionId: record.id, tagId })),
        });
      }

      if (body.type === 'INCOME' || body.type === 'EXPENSE') {
        const adjustment = body.type === 'INCOME' ? body.amount : -body.amount;
        await db.account.update({
          where: { id: body.accountId },
          data: { balance: { increment: adjustment } },
        });

        if (body.type === 'INCOME') {
          const account = await db.account.findUnique({
            where: { id: body.accountId },
            include: { linkedGoal: true },
          });
          if (account?.linkedGoal && account.isLocked) {
            const goal = account.linkedGoal;
            if (parseFloat(goal.currentAmount) < parseFloat(goal.targetAmount)) {
              await db.goalContribution.create({
                data: {
                  goalId: goal.id,
                  amount: body.amount,
                  accountId: body.accountId,
                  type: 'AUTO',
                  note: `Auto dari pemasukan ke ${account.name}`,
                  date: new Date(),
                  sourceTransactionId: record.id,
                },
              });
              await db.goal.update({
                where: { id: goal.id },
                data: { currentAmount: { increment: body.amount } },
              });
            }
          }
        }

        if (body.type === 'EXPENSE' && body.categoryId) {
          const category = await db.category.findFirst({
            where: { id: body.categoryId, name: { startsWith: 'Tabungan -' } },
          });
          if (category) {
            const goalName = category.name.replace('Tabungan - ', '').trim();
            const goal = await db.goal.findFirst({ where: { userId: token.userId, name: goalName, isLocked: false } });
            if (goal) {
              await db.goalContribution.create({
                data: {
                  goalId: goal.id,
                  amount: body.amount,
                  date: new Date(body.date),
                  note: body.note || `Dari transaksi: ${category.name}`,
                  accountId: body.accountId,
                  sourceTransactionId: record.id,
                },
              });
              await db.goal.update({
                where: { id: goal.id },
                data: { currentAmount: { increment: body.amount } },
              });
            }
          }
        }
      }

      if (body.type === 'TRANSFER' && body.fromAccountId && body.toAccountId) {
        const totalDeduct = parseFloat(body.amount) + adminFee;
        await db.account.update({
          where: { id: body.fromAccountId },
          data: { balance: { decrement: totalDeduct } },
        });
        await db.account.update({
          where: { id: body.toAccountId },
          data: { balance: { increment: body.amount } },
        });

        const toAccount = await db.account.findUnique({ where: { id: body.toAccountId }, include: { linkedGoal: true } });
        if (toAccount?.linkedGoal && toAccount.isLocked) {
          const goal = toAccount.linkedGoal;
          if (parseFloat(goal.currentAmount) < parseFloat(goal.targetAmount)) {
            await db.goalContribution.create({
              data: {
                goalId: goal.id,
                amount: body.amount,
                accountId: body.toAccountId,
                type: 'AUTO',
                note: `Auto dari transfer ke ${toAccount.name}`,
                date: new Date(),
                sourceTransactionId: record.id,
              },
            });
            await db.goal.update({
              where: { id: goal.id },
              data: { currentAmount: { increment: body.amount } },
            });

            const savingsCategory = await db.category.findFirst({
              where: { userId: token.userId, name: `Tabungan - ${goal.name}` },
            });
            if (savingsCategory) {
              await db.transaction.update({
                where: { id: record.id },
                data: { categoryId: savingsCategory.id },
              });
            }
          }
        }
      }

      const created = await db.transaction.findUnique({
        where: { id: record.id },
        include: { account: true, category: true, fromAccount: true, toAccount: true, tags: { include: { tag: true } } },
      });

      res.status(201).send(JSON.stringify({ transaction: { ...created, tags: created.tags.map(t => t.tag) } }));
      return;
    }

    // GET transaction by ID
    const transactionMatch = url.match(/^\/api\/transactions\/([a-f0-9-]+)$/i);
    if (transactionMatch && method === 'GET') {
      const transaction = await db.transaction.findFirst({
        where: { id: transactionMatch[1], userId: token.userId },
        include: { account: true, category: true, fromAccount: true, toAccount: true, tags: { include: { tag: true } } },
      });
      if (!transaction) {
        res.status(404).send(JSON.stringify({ message: 'Transaksi tidak ditemukan' }));
        return;
      }
      res.status(200).send(JSON.stringify({ transaction: { ...transaction, tags: transaction.tags.map(t => t.tag) } }));
      return;
    }

    // PUT update transaction
    if (transactionMatch && method === 'PUT') {
      const body = parseBody(req.body);
      const existing = await db.transaction.findFirst({
        where: { id: transactionMatch[1], userId: token.userId },
        include: { account: true, category: true },
      });
      if (!existing) {
        res.status(404).send(JSON.stringify({ message: 'Transaksi tidak ditemukan' }));
        return;
      }

      const newType = body.type ?? existing.type;
      const newAmount = body.amount !== undefined ? parseFloat(body.amount) : parseFloat(existing.amount);
      const newAdminFee = body.adminFee !== undefined ? parseFloat(body.adminFee) : parseFloat(existing.adminFee ?? 0);

      if (newType === 'TRANSFER' && newAdminFee > newAmount) {
        res.status(400).send(JSON.stringify({ message: 'Biaya admin tidak boleh lebih besar dari jumlah transfer' }));
        return;
      }

      await db.$transaction(async (tx) => {
        if (existing.type === 'INCOME' || existing.type === 'EXPENSE') {
          const reverse = existing.type === 'INCOME' ? -parseFloat(existing.amount) : parseFloat(existing.amount);
          await tx.account.update({
            where: { id: existing.accountId },
            data: { balance: { increment: reverse } },
          });
        }

        if (existing.type === 'TRANSFER' && existing.fromAccountId && existing.toAccountId) {
          const existingTotalDeduct = parseFloat(existing.amount) + parseFloat(existing.adminFee ?? 0);
          await tx.account.update({
            where: { id: existing.fromAccountId },
            data: { balance: { increment: existingTotalDeduct } },
          });
          await tx.account.update({
            where: { id: existing.toAccountId },
            data: { balance: { decrement: existing.amount } },
          });
        }

        const existingContribution = await tx.goalContribution.findFirst({
          where: { sourceTransactionId: transactionMatch[1] },
        });
        if (existingContribution) {
          await tx.goal.update({
            where: { id: existingContribution.goalId },
            data: { currentAmount: { decrement: existingContribution.amount } },
          });
          await tx.goalContribution.delete({ where: { id: existingContribution.id } });
        }

        const newAccountId = body.accountId ?? existing.accountId;
        if (newType === 'INCOME' || newType === 'EXPENSE') {
          const adjustment = newType === 'INCOME' ? newAmount : -newAmount;
          await tx.account.update({
            where: { id: newAccountId },
            data: { balance: { increment: adjustment } },
          });

          if (newType === 'EXPENSE' && body.categoryId) {
            const category = await tx.category.findFirst({
              where: { id: body.categoryId, name: { startsWith: 'Tabungan -' } },
            });
            if (category) {
              const goalName = category.name.replace('Tabungan - ', '').trim();
              const goal = await tx.goal.findFirst({ where: { userId: token.userId, name: goalName, isLocked: false } });
              if (goal) {
                await tx.goalContribution.create({
                  data: {
                    goalId: goal.id,
                    amount: newAmount,
                    date: new Date(body.date || existing.date),
                    note: body.note || `Dari transaksi: ${category.name}`,
                    accountId: newAccountId,
                    sourceTransactionId: transactionMatch[1],
                  },
                });
                await tx.goal.update({ where: { id: goal.id }, data: { currentAmount: { increment: newAmount } } });
              }
            }
          }
        }

        if (newType === 'TRANSFER' && body.fromAccountId && body.toAccountId) {
          const newTotalDeduct = newAmount + newAdminFee;
          await tx.account.update({
            where: { id: body.fromAccountId },
            data: { balance: { decrement: newTotalDeduct } },
          });
          await tx.account.update({
            where: { id: body.toAccountId },
            data: { balance: { increment: newAmount } },
          });
        }

        const sanitizedData = { ...body };
        if (sanitizedData.fromAccountId === '') sanitizedData.fromAccountId = null;
        if (sanitizedData.toAccountId === '') sanitizedData.toAccountId = null;
        sanitizedData.adminFee = newAdminFee;
        if (body.date) sanitizedData.date = new Date(body.date);

        await tx.transaction.update({
          where: { id: transactionMatch[1] },
          data: sanitizedData,
        });

        if (body.tagIds !== undefined) {
          await tx.transactionTag.deleteMany({ where: { transactionId: transactionMatch[1] } });
          if (body.tagIds.length > 0) {
            await tx.transactionTag.createMany({
              data: body.tagIds.map(tagId => ({ transactionId: transactionMatch[1], tagId })),
            });
          }
        }
      });

      const updated = await db.transaction.findUnique({
        where: { id: transactionMatch[1] },
        include: { account: true, category: true, fromAccount: true, toAccount: true, tags: { include: { tag: true } } },
      });
      res.status(200).send(JSON.stringify({ transaction: { ...updated, tags: updated.tags.map(t => t.tag) } }));
      return;
    }

    // DELETE transaction
    if (transactionMatch && method === 'DELETE') {
      const existing = await db.transaction.findFirst({
        where: { id: transactionMatch[1], userId: token.userId },
      });
      if (!existing) {
        res.status(404).send(JSON.stringify({ message: 'Transaksi tidak ditemukan' }));
        return;
      }

      await db.$transaction(async (tx) => {
        if (existing.type === 'INCOME' || existing.type === 'EXPENSE') {
          const adjustment = existing.type === 'INCOME' ? -parseFloat(existing.amount) : parseFloat(existing.amount);
          await tx.account.update({
            where: { id: existing.accountId },
            data: { balance: { increment: adjustment } },
          });
        }

        if (existing.type === 'TRANSFER' && existing.fromAccountId && existing.toAccountId) {
          const totalRefund = parseFloat(existing.amount) + parseFloat(existing.adminFee ?? 0);
          await tx.account.update({
            where: { id: existing.fromAccountId },
            data: { balance: { increment: totalRefund } },
          });
          await tx.account.update({
            where: { id: existing.toAccountId },
            data: { balance: { decrement: existing.amount } },
          });
        }

        const contribution = await tx.goalContribution.findFirst({
          where: { sourceTransactionId: transactionMatch[1] },
        });
        if (contribution) {
          await tx.goal.update({
            where: { id: contribution.goalId },
            data: { currentAmount: { decrement: contribution.amount } },
          });
          const goal = await tx.goal.findUnique({ where: { id: contribution.goalId } });
          if (goal && goal.status === 'COMPLETED') {
            await tx.goal.update({
              where: { id: contribution.goalId },
              data: { status: 'ACTIVE' },
            });
          }
          await tx.goalContribution.delete({ where: { id: contribution.id } });
        }

        await tx.transaction.delete({ where: { id: transactionMatch[1] } });
      });

      res.status(204).end();
      return;
    }

    // GET recent transactions
    if (url === '/api/transactions/recent' && method === 'GET') {
      const limit = parseInt(queryParams.get('limit') || '5');
      const transactions = await db.transaction.findMany({
        where: { userId: token.userId },
        include: { account: true, category: true },
        orderBy: { date: 'desc' },
        take: limit,
      });
      res.status(200).send(JSON.stringify({ transactions }));
      return;
    }

    // GET transactions summary
    if (url === '/api/transactions/summary' && method === 'GET') {
      const startDate = queryParams.get('startDate');
      const endDate = queryParams.get('endDate');
      const where = { userId: token.userId };
      if (startDate || endDate) {
        where.date = {};
        if (startDate) where.date.gte = new Date(startDate);
        if (endDate) where.date.lte = new Date(endDate);
      }
      const transactions = await db.transaction.findMany({ where });
      const income = transactions.filter(t => t.type === 'INCOME').reduce((sum, t) => sum + parseFloat(t.amount), 0);
      const expense = transactions.filter(t => t.type === 'EXPENSE').reduce((sum, t) => sum + Math.abs(parseFloat(t.amount)), 0);
      const transfer = transactions.filter(t => t.type === 'TRANSFER').reduce((sum, t) => sum + parseFloat(t.amount), 0);
      res.status(200).send(JSON.stringify({ income, expense, transfer, balance: income - expense }));
      return;
    }

    res.status(404).send(JSON.stringify({ error: 'Not found', url, method }));
  } catch (err) {
    console.error('Transactions handler error:', err);
    res.status(500).send(JSON.stringify({ message: 'Internal server error', error: String(err) }));
  } finally {
    if (db) {
      try { await db.$disconnect(); } catch {}
    }
  }
}