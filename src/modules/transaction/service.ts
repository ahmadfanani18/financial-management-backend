import { prisma } from '../../config/prisma.js';
import type { CreateTransactionInput, UpdateTransactionInput, TransactionQuery } from './schemas.js';

const VALID_TYPES = ['INCOME', 'EXPENSE', 'TRANSFER'];

function calculateBudgetEndDate(startDate: Date, period: string): Date {
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

export class TransactionService {
  async getAll(userId: string, query: TransactionQuery) {
    const where: any = { userId };
    
    if (query.accountId) where.accountId = query.accountId;
    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.type && VALID_TYPES.includes(query.type)) where.type = query.type;
    if (query.startDate && query.endDate) {
      where.date = { gte: query.startDate, lte: query.endDate };
    }
    if (query.minAmount || query.maxAmount) {
      where.amount = {};
      if (query.minAmount) where.amount.gte = query.minAmount;
      if (query.maxAmount) where.amount.lte = query.maxAmount;
    }
    if (query.search) {
      where.description = { contains: query.search, mode: 'insensitive' };
    }

    const skip = (query.page - 1) * query.limit;
    
    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: { date: 'desc' },
        include: {
          account: true,
          category: true,
          fromAccount: true,
          toAccount: true,
          tags: { include: { tag: true } },
        },
      }),
      prisma.transaction.count({ where }),
    ]);

    return {
      transactions: transactions.map(t => ({
        ...t,
        tags: t.tags.map(t => t.tag),
      })),
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit),
    };
  }

  async getById(id: string, userId: string) {
    const transaction = await prisma.transaction.findFirst({
      where: { id, userId },
      include: {
        account: true,
        category: true,
        fromAccount: true,
        toAccount: true,
        tags: { include: { tag: true } },
      },
    });
    if (!transaction) throw new Error('Transaksi tidak ditemukan');
    return { ...transaction, tags: transaction.tags.map(t => t.tag) };
  }

  async validateCategoryForExpense(userId: string, categoryId: string, date: Date) {
    const budgets = await prisma.budget.findMany({
      where: {
        userId,
        categoryId,
        isActive: true,
      },
    });

    if (budgets.length === 0) {
      return null;
    }

    const transactionDate = new Date(date);
    let validBudget = null;

    for (const budget of budgets) {
      const startDate = new Date(budget.startDate);
      const endDate = budget.endDate ? new Date(budget.endDate) : calculateBudgetEndDate(startDate, budget.period);

      if (transactionDate >= startDate && transactionDate <= endDate) {
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
      throw new Error(`Transaksi pada tanggal ${transactionDate.toLocaleDateString('id-ID')} tidak berada dalam periode budget aktif (${periods}).`);
    }

    const startDate = new Date(validBudget.startDate);
    const endDate = validBudget.endDate ? new Date(validBudget.endDate) : calculateBudgetEndDate(startDate, validBudget.period);
    const periodLabels: Record<string, string> = { MONTHLY: 'Bulanan', WEEKLY: 'Mingguan', YEARLY: 'Tahunan' };
    const periodLabel = periodLabels[validBudget.period] || validBudget.period;

    if (transactionDate < startDate || transactionDate > endDate) {
      throw new Error(`Transaksi berada di luar periode budget ${periodLabel} (${startDate.toLocaleDateString('id-ID')} - ${endDate.toLocaleDateString('id-ID')}).`);
    }

    return validBudget;
  }

  async create(userId: string, input: CreateTransactionInput) {
    if (input.type === 'EXPENSE' && input.categoryId) {
      await this.validateCategoryForExpense(userId, input.categoryId, new Date(input.date));
    }

    if (input.type === 'TRANSFER' && input.adminFee && input.adminFee > Number(input.amount)) {
      throw new Error('Biaya admin tidak boleh lebih besar dari jumlah transfer');
    }

    const { tagIds, ...data } = input;
    const adminFee = Number(input.adminFee ?? 0);

    const transactionData = {
      type: input.type,
      amount: input.amount,
      accountId: input.accountId,
      categoryId: input.categoryId,
      fromAccountId: input.fromAccountId,
      toAccountId: input.toAccountId,
      description: input.description || '',
      note: input.note,
      date: new Date(input.date),
      receiptUrl: input.receiptUrl,
      isRecurring: input.isRecurring,
      recurringPattern: input.recurringPattern,
      userId,
      adminFee,
      deductGoals: input.deductGoals ?? false,
    };

    const transaction = await prisma.$transaction(async (tx) => {
      const record = await tx.transaction.create({
        data: transactionData,
      });

      if (tagIds?.length) {
        await tx.transactionTag.createMany({
          data: tagIds.map(tagId => ({
            transactionId: record.id,
            tagId,
          })),
        });
      }

      if (input.type === 'INCOME' || input.type === 'EXPENSE') {
        const adjustment = input.type === 'INCOME' ? input.amount : -input.amount;
        await tx.account.update({
          where: { id: input.accountId },
          data: { balance: { increment: adjustment } },
        });

        if (input.type === 'EXPENSE' && input.deductGoals) {
          const account = await tx.account.findUnique({
            where: { id: input.accountId },
            include: { linkedGoal: true },
          });

          if (!account?.linkedGoalId) {
            throw new Error('Akun ini tidak terhubung dengan Goals manapun');
          }

          const goal = account.linkedGoal;
          if (Number(goal.currentAmount) < input.amount) {
            throw new Error('Jumlah Goals tidak mencukupi untuk transaksi ini');
          }

          await tx.goal.update({
            where: { id: goal.id },
            data: { currentAmount: { decrement: input.amount } },
          });
        }

        if (input.type === 'EXPENSE' && input.categoryId) {
          const category = await tx.category.findFirst({
            where: { 
              id: input.categoryId,
              name: { startsWith: 'Tabungan -' },
            },
          });

          if (category) {
            const goalName = category.name.replace('Tabungan - ', '').trim();
            
            const goal = await tx.goal.findFirst({
              where: {
                userId,
                name: goalName,
                isLocked: false,
              },
            });

            if (goal) {
              await tx.goalContribution.create({
                data: {
                  goalId: goal.id,
                  amount: input.amount,
                  date: new Date(input.date),
                  note: input.note || `Dari transaksi: ${category.name}`,
                  accountId: input.accountId,
                  sourceTransactionId: record.id,
                },
              });

              await tx.goal.update({
                where: { id: goal.id },
                data: {
                  currentAmount: { increment: input.amount },
                },
              });
            }
          }
        }
      }

      if (input.type === 'TRANSFER' && input.fromAccountId && input.toAccountId) {
        const totalDeduct = Number(input.amount) + adminFee;
        await tx.account.update({
          where: { id: input.fromAccountId },
          data: { balance: { decrement: totalDeduct } },
        });
        await tx.account.update({
          where: { id: input.toAccountId },
          data: { balance: { increment: input.amount } },
        });

        await this.handleAutoContribution(tx, input.toAccountId, input.amount, userId, record.id, new Date(input.date));
      }

      return record;
    });

    return this.getById(transaction.id, userId);
  }

  async update(id: string, userId: string, input: UpdateTransactionInput) {
    const existing = await this.getById(id, userId);
    const { tagIds, ...data } = input;

    const newType = input.type ?? existing.type;
    const newAmount = input.amount ?? Number(existing.amount);
    const newAdminFee = input.adminFee ?? Number(existing.adminFee ?? 0);
    const newFromAccountId = input.fromAccountId ?? existing.fromAccountId;
    const newToAccountId = input.toAccountId ?? existing.toAccountId;
    const newAccountId = input.accountId ?? existing.accountId;

    if (newType === 'TRANSFER' && newAdminFee > newAmount) {
      throw new Error('Biaya admin tidak boleh lebih besar dari jumlah transfer');
    }

    const sanitizedData: any = { ...data };
    if (sanitizedData.fromAccountId === '') sanitizedData.fromAccountId = null;
    if (sanitizedData.toAccountId === '') sanitizedData.toAccountId = null;
    sanitizedData.adminFee = newAdminFee;

    await prisma.$transaction(async (tx) => {
      const existingDeductGoals = existing.deductGoals;

      if (existing.type === 'INCOME' || existing.type === 'EXPENSE') {
        const reverse = existing.type === 'INCOME' ? -Number(existing.amount) : Number(existing.amount);
        await tx.account.update({
          where: { id: existing.accountId },
          data: { balance: { increment: reverse } },
        });

        if (existing.type === 'EXPENSE' && existingDeductGoals) {
          const account = await tx.account.findUnique({
            where: { id: existing.accountId },
            include: { linkedGoal: true },
          });
          if (account?.linkedGoalId) {
            await tx.goal.update({
              where: { id: account.linkedGoalId },
              data: { currentAmount: { increment: existing.amount } },
            });
          }
        }
      }

      if (existing.type === 'TRANSFER' && existing.fromAccountId && existing.toAccountId) {
        const existingTotalDeduct = Number(existing.amount) + Number(existing.adminFee ?? 0);
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
        where: { sourceTransactionId: id },
      });
      if (existingContribution) {
        await tx.goal.update({
          where: { id: existingContribution.goalId },
          data: { currentAmount: { decrement: existingContribution.amount } },
        });
        await tx.goalContribution.delete({
          where: { id: existingContribution.id },
        });
      }

      if (newType === 'INCOME' || newType === 'EXPENSE') {
        const adjustment = newType === 'INCOME' ? newAmount : -newAmount;
        await tx.account.update({
          where: { id: newAccountId },
          data: { balance: { increment: adjustment } },
        });

        const newDeductGoals = input.deductGoals ?? existing.deductGoals;
        if (newType === 'EXPENSE' && newDeductGoals) {
          const account = await tx.account.findUnique({
            where: { id: newAccountId },
            include: { linkedGoal: true },
          });

          if (!account?.linkedGoalId) {
            throw new Error('Akun ini tidak terhubung dengan Goals manapun');
          }

          const goal = account.linkedGoal;
          if (Number(goal.currentAmount) < newAmount) {
            throw new Error('Jumlah Goals tidak mencukupi untuk transaksi ini');
          }

          await tx.goal.update({
            where: { id: goal.id },
            data: { currentAmount: { decrement: newAmount } },
          });
        }

        if (newType === 'EXPENSE' && sanitizedData.categoryId) {
          const category = await tx.category.findFirst({
            where: { id: sanitizedData.categoryId, name: { startsWith: 'Tabungan -' } },
          });
          if (category) {
            const goalName = category.name.replace('Tabungan - ', '').trim();
            const goal = await tx.goal.findFirst({ where: { userId, name: goalName, isLocked: false } });
            if (goal) {
              await tx.goalContribution.create({
                data: {
                  goalId: goal.id,
                  amount: newAmount,
                  date: new Date(sanitizedData.date),
                  note: sanitizedData.note || `Dari transaksi: ${category.name}`,
                  accountId: newAccountId,
                  sourceTransactionId: id,
                },
              });
              await tx.goal.update({ where: { id: goal.id }, data: { currentAmount: { increment: newAmount } } });
            }
          }
        }
      }

      if (newType === 'TRANSFER' && newFromAccountId && newToAccountId) {
        const newTotalDeduct = newAmount + newAdminFee;
        await tx.account.update({
          where: { id: newFromAccountId },
          data: { balance: { decrement: newTotalDeduct } },
        });
        await tx.account.update({
          where: { id: newToAccountId },
          data: { balance: { increment: newAmount } },
        });

        const toAccount = await tx.account.findUnique({ where: { id: newToAccountId }, include: { linkedGoal: true } });
        if (toAccount?.linkedGoal && toAccount.isLocked) {
          const goal = toAccount.linkedGoal;
          if (Number(goal.currentAmount) < Number(goal.targetAmount)) {
            await tx.goalContribution.create({
              data: {
                goalId: goal.id,
                amount: newAmount,
                accountId: newToAccountId,
                type: 'AUTO',
                note: `Auto dari transfer ke ${toAccount.name}`,
                date: new Date(),
                sourceTransactionId: id,
              },
            });
            await tx.goal.update({ where: { id: goal.id }, data: { currentAmount: { increment: newAmount } } });
          }
        }
      }

      await tx.transaction.update({
        where: { id },
        data: sanitizedData,
      });

      if (tagIds !== undefined) {
        await tx.transactionTag.deleteMany({ where: { transactionId: id } });
        if (tagIds.length > 0) {
          await tx.transactionTag.createMany({
            data: tagIds.map(tagId => ({ transactionId: id, tagId })),
          });
        }
      }
    });

    return this.getById(id, userId);
  }

  async delete(id: string, userId: string) {
    const transaction = await this.getById(id, userId);

    await prisma.$transaction(async (tx) => {
      if (transaction.type === 'INCOME' || transaction.type === 'EXPENSE') {
        const adjustment = transaction.type === 'INCOME' ? -Number(transaction.amount) : Number(transaction.amount);
        await tx.account.update({
          where: { id: transaction.accountId },
          data: { balance: { increment: adjustment } },
        });

        if (transaction.type === 'EXPENSE' && transaction.deductGoals) {
          const account = await tx.account.findUnique({
            where: { id: transaction.accountId },
            include: { linkedGoal: true },
          });
          if (account?.linkedGoalId) {
            await tx.goal.update({
              where: { id: account.linkedGoalId },
              data: { currentAmount: { increment: transaction.amount } },
            });
          }
        }
      }

      if (transaction.type === 'TRANSFER' && transaction.fromAccountId && transaction.toAccountId) {
        const totalRefund = Number(transaction.amount) + Number(transaction.adminFee ?? 0);
        await tx.account.update({
          where: { id: transaction.fromAccountId },
          data: { balance: { increment: totalRefund } },
        });
        await tx.account.update({
          where: { id: transaction.toAccountId },
          data: { balance: { decrement: transaction.amount } },
        });
      }

      const contribution = await tx.goalContribution.findFirst({
        where: { sourceTransactionId: id },
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

        await tx.goalContribution.delete({
          where: { id: contribution.id },
        });
      }

      await tx.transaction.delete({ where: { id } });
    });
  }

  async getRecent(userId: string, limit: number = 5) {
    return prisma.transaction.findMany({
      where: { userId },
      take: limit,
      orderBy: { date: 'desc' },
      include: {
        account: true,
        category: true,
      },
    });
  }

  async getSummary(userId: string, startDate: Date, endDate: Date) {
    const transactions = await prisma.transaction.findMany({
      where: {
        userId,
        date: { gte: startDate, lte: endDate },
      },
    });

    const income = transactions
      .filter(t => t.type === 'INCOME')
      .reduce((sum, t) => sum + Number(t.amount.toString()), 0);

    const expense = transactions
      .filter(t => t.type === 'EXPENSE')
      .reduce((sum, t) => sum + Number(t.amount.toString()), 0);

    return { income, expense, balance: income - expense };
  }

  private async handleAutoContribution(tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0], accountId: string, amount: number, userId: string, sourceTransactionId?: string, txDate?: Date) {
    const account = await tx.account.findUnique({
      where: { id: accountId },
      include: { linkedGoal: true },
    });

    if (!account?.linkedGoal || !account.isLocked) return;

    const goal = account.linkedGoal;

    if (Number(goal.currentAmount) >= Number(goal.targetAmount)) return;

    const contribution = await tx.goalContribution.create({
      data: {
        goalId: goal.id,
        amount,
        accountId,
        type: 'AUTO',
        note: `Auto dari transfer ke ${account.name}`,
        date: new Date(),
        sourceTransactionId: sourceTransactionId,
      },
    });

    if (sourceTransactionId) {
      const category = await tx.category.findFirst({
        where: {
          userId,
          name: `Tabungan - ${goal.name}`,
        },
      });

      if (category) {
        await tx.transaction.update({
          where: { id: sourceTransactionId },
          data: { categoryId: category.id },
        });
      }
    }

    await tx.goal.update({
      where: { id: goal.id },
      data: { currentAmount: { increment: amount } },
    });

    const budgets = await tx.budget.findMany({
      where: {
        userId,
        isActive: true,
        category: {
          name: { startsWith: 'Tabungan - ' },
          userId,
        },
      },
      include: { category: true },
    });

    console.log('DEBUG handleAutoContribution - userId:', userId);
    console.log('DEBUG handleAutoContribution - goal.name:', goal.name);
    console.log('DEBUG handleAutoContribution - budgets found:', budgets.length);
    console.log('DEBUG handleAutoContribution - budget names:', budgets.map(b => b.category.name));

    const effectiveDate = txDate instanceof Date ? txDate : new Date();
    const txMonth = effectiveDate.getMonth();
    const txYear = effectiveDate.getFullYear();
    
    const goalBudget = budgets.find(b => {
      const endDate = new Date(b.endDate);
      return b.category.name === 'Tabungan - ' + goal.name
        && endDate.getMonth() === txMonth
        && endDate.getFullYear() === txYear;
    });

    console.log('DEBUG handleAutoContribution - txDate:', effectiveDate.toISOString());
    console.log('DEBUG handleAutoContribution - matched budget:', goalBudget?.id, 'endDate:', goalBudget?.endDate);

    if (goalBudget) {
      await tx.budget.update({
        where: { id: goalBudget.id },
        data: { spent: { increment: amount } },
      });
    }
  }
}

export const transactionService = new TransactionService();
