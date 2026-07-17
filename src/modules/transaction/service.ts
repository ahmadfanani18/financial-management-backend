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
        const account = await tx.account.findUnique({ where: { id: input.accountId } });
        const currentBalance = Number(account?.balance || 0);
        const newBalance = currentBalance + adjustment;
        await tx.account.update({
          where: { id: input.accountId },
          data: { balance: String(newBalance) },
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

          const goalDec1 = await tx.goal.findUnique({ where: { id: goal.id } });
          await tx.goal.update({
            where: { id: goal.id },
            data: { currentAmount: String(Number(goalDec1!.currentAmount) - input.amount) },
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

              const goalInc1 = await tx.goal.findUnique({ where: { id: goal.id } });
              await tx.goal.update({
                where: { id: goal.id },
                data: { currentAmount: String(Number(goalInc1!.currentAmount) + input.amount) },
              });
            }
          }
        }
      }

      if (input.type === 'TRANSFER' && input.fromAccountId && input.toAccountId) {
        const totalDeduct = Number(input.amount) + adminFee;
        const fromAccount = await tx.account.findUnique({ where: { id: input.fromAccountId } });
        const toAccount = await tx.account.findUnique({ where: { id: input.toAccountId } });
        const fromBalance = Number(fromAccount?.balance || 0) - totalDeduct;
        const toBalance = Number(toAccount?.balance || 0) + Number(input.amount);
        await tx.account.update({
          where: { id: input.fromAccountId },
          data: { balance: String(fromBalance) },
        });
        await tx.account.update({
          where: { id: input.toAccountId },
          data: { balance: String(toBalance) },
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
        const acc = await tx.account.findUnique({ where: { id: existing.accountId } });
        const newBal = Number(acc?.balance || 0) + reverse;
        await tx.account.update({
          where: { id: existing.accountId },
          data: { balance: String(newBal) },
        });

        if (existing.type === 'EXPENSE' && existingDeductGoals) {
          const account = await tx.account.findUnique({
            where: { id: existing.accountId },
            include: { linkedGoal: true },
          });
          if (account?.linkedGoalId) {
            const goalInc2 = await tx.goal.findUnique({ where: { id: account.linkedGoalId } });
            await tx.goal.update({
              where: { id: account.linkedGoalId },
              data: { currentAmount: String(Number(goalInc2!.currentAmount) + Number(existing.amount)) },
            });
          }
        }
      }

      if (existing.type === 'TRANSFER' && existing.fromAccountId && existing.toAccountId) {
        const existingTotalDeduct = Number(existing.amount) + Number(existing.adminFee ?? 0);
        const fromAcc = await tx.account.findUnique({ where: { id: existing.fromAccountId } });
        const toAcc = await tx.account.findUnique({ where: { id: existing.toAccountId } });
        const newFromBal = Number(fromAcc?.balance || 0) + existingTotalDeduct;
        const newToBal = Number(toAcc?.balance || 0) - Number(existing.amount);
        await tx.account.update({
          where: { id: existing.fromAccountId },
          data: { balance: String(newFromBal) },
        });
        await tx.account.update({
          where: { id: existing.toAccountId },
          data: { balance: String(newToBal) },
        });
      }

      const existingContribution = await tx.goalContribution.findFirst({
        where: { sourceTransactionId: id },
      });
      if (existingContribution) {
        const goalDec2 = await tx.goal.findUnique({ where: { id: existingContribution.goalId } });
        await tx.goal.update({
          where: { id: existingContribution.goalId },
          data: { currentAmount: String(Number(goalDec2!.currentAmount) - Number(existingContribution.amount)) },
        });
        await tx.goalContribution.delete({
          where: { id: existingContribution.id },
        });
      }

      if (newType === 'INCOME' || newType === 'EXPENSE') {
        const adjustment = newType === 'INCOME' ? newAmount : -newAmount;
        const acc = await tx.account.findUnique({ where: { id: newAccountId } });
        const newBal = Number(acc?.balance || 0) + adjustment;
        await tx.account.update({
          where: { id: newAccountId },
          data: { balance: String(newBal) },
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

          const goalDec3 = await tx.goal.findUnique({ where: { id: goal.id } });
          await tx.goal.update({
            where: { id: goal.id },
            data: { currentAmount: String(Number(goalDec3!.currentAmount) - newAmount) },
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
              const goalInc3 = await tx.goal.findUnique({ where: { id: goal.id } });
              await tx.goal.update({ where: { id: goal.id }, data: { currentAmount: String(Number(goalInc3!.currentAmount) + newAmount) } });
            }
          }
        }
      }

      if (newType === 'TRANSFER' && newFromAccountId && newToAccountId) {
        const newTotalDeduct = newAmount + newAdminFee;
        const fromAcc = await tx.account.findUnique({ where: { id: newFromAccountId } });
        const toAcc = await tx.account.findUnique({ where: { id: newToAccountId } });
        const newFromBal = Number(fromAcc?.balance || 0) - newTotalDeduct;
        const newToBal = Number(toAcc?.balance || 0) + newAmount;
        await tx.account.update({
          where: { id: newFromAccountId },
          data: { balance: String(newFromBal) },
        });
        await tx.account.update({
          where: { id: newToAccountId },
          data: { balance: String(newToBal) },
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
            const goalInc4 = await tx.goal.findUnique({ where: { id: goal.id } });
            await tx.goal.update({ where: { id: goal.id }, data: { currentAmount: String(Number(goalInc4!.currentAmount) + newAmount) } });
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
        const account = await tx.account.findUnique({ where: { id: transaction.accountId } });
        const currentBalance = Number(account?.balance || 0);
        const newBalance = currentBalance + adjustment;
        await tx.account.update({
          where: { id: transaction.accountId },
          data: { balance: String(newBalance) },
        });

        if (transaction.type === 'EXPENSE' && transaction.deductGoals) {
          const account = await tx.account.findUnique({
            where: { id: transaction.accountId },
            include: { linkedGoal: true },
          });
          if (account?.linkedGoalId) {
            const goalInc5 = await tx.goal.findUnique({ where: { id: account.linkedGoalId } });
            await tx.goal.update({
              where: { id: account.linkedGoalId },
              data: { currentAmount: String(Number(goalInc5!.currentAmount) + Number(transaction.amount)) },
            });
          }
        }
      }

      if (transaction.type === 'TRANSFER' && transaction.fromAccountId && transaction.toAccountId) {
        const totalRefund = Number(transaction.amount) + Number(transaction.adminFee ?? 0);
        const fromAcc = await tx.account.findUnique({ where: { id: transaction.fromAccountId } });
        const toAcc = await tx.account.findUnique({ where: { id: transaction.toAccountId } });
        const newFromBal = Number(fromAcc?.balance || 0) + totalRefund;
        const newToBal = Number(toAcc?.balance || 0) - Number(transaction.amount);
        await tx.account.update({
          where: { id: transaction.fromAccountId },
          data: { balance: String(newFromBal) },
        });
        await tx.account.update({
          where: { id: transaction.toAccountId },
          data: { balance: String(newToBal) },
        });
      }

      const contribution = await tx.goalContribution.findFirst({
        where: { sourceTransactionId: id },
      });

      if (contribution) {
        const goalDec4 = await tx.goal.findUnique({ where: { id: contribution.goalId } });
        await tx.goal.update({
          where: { id: contribution.goalId },
          data: { currentAmount: String(Number(goalDec4!.currentAmount) - Number(contribution.amount)) },
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

  async getTemplateData(userId: string) {
    const [categories, accounts] = await Promise.all([
      prisma.category.findMany({
        where: { userId },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
      prisma.account.findMany({
        where: { userId },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
    ]);
    return { categories, accounts };
  }

  async parseAndValidateCsv(
    userId: string,
    csvContent: string
  ): Promise<{
    validRows: Array<{
      date: string;
      description: string;
      categoryId: string;
      accountId: string;
      categoryName: string;
      accountName: string;
      amount: number;
      type: 'INCOME' | 'EXPENSE';
    }>;
    errorRows: Array<{ row: number; data: Record<string, any>; error: string }>;
    summary: { valid: number; errors: number; total: number };
  }> {
    const Papa = await import('papaparse');
    const parsed = Papa.default.parse(csvContent, { header: true, skipEmptyLines: true });

    const categories = await prisma.category.findMany({
      where: { userId },
      select: { id: true, name: true },
    });
    const categoryMap = new Map(categories.map(c => [c.name.toLowerCase(), c]));
    const categoryNameMap = new Map(categories.map(c => [c.id, c.name]));

    const accounts = await prisma.account.findMany({
      where: { userId },
      select: { id: true, name: true },
    });
    const accountMap = new Map(accounts.map(a => [a.name.toLowerCase(), a]));
    const accountNameMap = new Map(accounts.map(a => [a.id, a.name]));

    const validRows: Array<{
      date: string;
      description: string;
      categoryId: string;
      accountId: string;
      categoryName: string;
      accountName: string;
      amount: number;
      type: 'INCOME' | 'EXPENSE';
    }> = [];
    const errorRows: Array<{ row: number; data: Record<string, any>; error: string }> = [];
    const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;
    const dmyDateRegex = /^\d{2}\/\d{2}\/\d{4}$/;

    const parseDate = (dateStr: string): string | null => {
      if (isoDateRegex.test(dateStr)) {
        return dateStr;
      }
      if (dmyDateRegex.test(dateStr)) {
        const [day, month, year] = dateStr.split('/');
        return `${year}-${month}-${day}`;
      }
      return null;
    };

    parsed.data.forEach((row: any, index: number) => {
      if (!row.date && !row.description) return;
      
      const rowNum = index + 2;
      const dateInput = String(row.date || '').trim();
      const description = String(row.description || '').trim();
      const categoryNameInput = String(row.category || '').trim().toLowerCase();
      const accountNameInput = String(row.account || '').trim().toLowerCase();
      const amount = parseFloat(String(row.amount || '').trim());
      const typeInput = String(row.type || '').trim().toUpperCase();

      const errors: string[] = [];

      const parsedDate = parseDate(dateInput);
      if (!parsedDate) {
        errors.push('Format tanggal harus YYYY-MM-DD atau DD/MM/YYYY');
      }

      if (!description) {
        errors.push('Deskripsi wajib diisi');
      }

      const category = categoryMap.get(categoryNameInput);
      if (!category) {
        errors.push('Kategori tidak ditemukan');
      }

      const account = accountMap.get(accountNameInput);
      if (!account) {
        errors.push('Akun tidak ditemukan');
      }

      if (isNaN(amount) || amount <= 0) {
        errors.push('Jumlah harus angka positif');
      }

      if (typeInput !== 'INCOME' && typeInput !== 'EXPENSE') {
        errors.push('Tipe harus INCOME atau EXPENSE');
      }

      if (errors.length > 0) {
        errorRows.push({ row: rowNum, data: row, error: errors.join('; ') });
      } else {
        validRows.push({
          date: parsedDate!,
          description,
          categoryId: category!.id,
          accountId: account!.id,
          categoryName: categoryNameMap.get(category!.id) || category!.name,
          accountName: accountNameMap.get(account!.id) || account!.name,
          amount,
          type: typeInput as 'INCOME' | 'EXPENSE',
        });
      }
    });

    return {
      validRows,
      errorRows,
      summary: {
        valid: validRows.length,
        errors: errorRows.length,
        total: parsed.data.length,
      },
    };
  }

  async parseAndValidateXlsx(
    userId: string,
    buffer: Buffer
  ): Promise<{
    validRows: Array<{
      date: string;
      description: string;
      categoryId: string;
      accountId: string;
      categoryName: string;
      accountName: string;
      fromAccountId?: string;
      toAccountId?: string;
      fromAccountName?: string;
      toAccountName?: string;
      amount: number;
      adminFee?: number;
      type: 'INCOME' | 'EXPENSE' | 'TRANSFER';
    }>;
    errorRows: Array<{ row: number; data: Record<string, any>; error: string }>;
    summary: { valid: number; errors: number; total: number };
  }> {
    const ExcelJSModule = await import('exceljs');
    const ExcelJS = ExcelJSModule.default || ExcelJSModule;
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    
    const sheet = workbook.getWorksheet(1);
    
    // Read header row (row 1) - only first 9 columns
    const headerRow = sheet.getRow(1);
    const headers: string[] = [];
    for (let col = 1; col <= 9; col++) {
      headers.push(String(headerRow.getCell(col).value || '').toLowerCase().trim().replace(/\*+$/, ''));
    }
    
    const headerMap: Record<string, number> = {};
    headers.forEach((h, i) => { headerMap[h] = i; });
    
    // Read data rows (rows 3 onwards, before reference section at row 100)
    const dataRows: { rowNum: number; data: any[] }[] = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber >= 3 && rowNumber < 100) {
        const rowData: any[] = [];
        for (let col = 1; col <= 9; col++) {
          const cell = row.getCell(col);
          let value = cell.value;
          // Handle Excel date serial numbers
          if (col === 1 && typeof value === 'number' && value > 0 && value < 100000) {
            const excelEpoch = new Date(Date.UTC(1899, 11, 30));
            const d = new Date(excelEpoch.getTime() + value * 86400000);
            const year = d.getUTCFullYear();
            const month = String(d.getUTCMonth() + 1).padStart(2, '0');
            const day = String(d.getUTCDate()).padStart(2, '0');
            value = `${year}-${month}-${day}`;
          }
          rowData.push(value);
        }
        dataRows.push({ rowNum: rowNumber, data: rowData });
      }
    });
    
    if (dataRows.length === 0) {
      return {
        validRows: [],
        errorRows: [{ row: 1, data: {}, error: 'File kosong atau tidak memiliki data' }],
        summary: { valid: 0, errors: 1, total: 0 },
      };
    }
    
    const [categories, accounts] = await Promise.all([
      prisma.category.findMany({
        where: { userId },
        select: { id: true, name: true },
      }),
      prisma.account.findMany({
        where: { userId },
        select: { id: true, name: true },
      }),
    ]);
    
    const categoryMap = new Map(categories.map(c => [c.name.toLowerCase(), c]));
    const accountMap = new Map(accounts.map(a => [a.name.toLowerCase(), a]));
    
    const validRows: any[] = [];
    const errorRows: any[] = [];
    
    for (const { rowNum, data: row } of dataRows) {
      const getValue = (col: string) => {
        const idx = headerMap[col];
        return idx !== undefined ? String(row[idx] || '').trim() : '';
      };
      
      const dateInput = getValue('date');
      const description = getValue('description');
      const typeInput = getValue('type').toLowerCase();
      const categoryNameInput = getValue('category').toLowerCase();
      const accountNameInput = getValue('account').toLowerCase();
      const fromAccountInput = getValue('fromaccount').toLowerCase();
      const toAccountInput = getValue('toaccount').toLowerCase();
      const amountStr = getValue('amount');
      const adminFeeStr = getValue('adminfee');
      
      const errors: string[] = [];
      
      if (!dateInput && !description) continue;
      
      const parsedDate = this.parseDateString(dateInput);
      if (!parsedDate) {
        errors.push('Format tanggal tidak valid. Gunakan YYYY-MM-DD atau DD/MM/YYYY');
      }
      
      if (!description) {
        errors.push('Deskripsi wajib diisi');
      }
      
      if (!['income', 'expense', 'transfer'].includes(typeInput)) {
        errors.push('Type harus: income, expense, atau transfer');
      }
      
      const amount = parseFloat(amountStr);
      if (isNaN(amount) || amount <= 0) {
        errors.push('Jumlah harus angka positif');
      }
      
      let categoryId: string | undefined;
      let accountId: string | undefined;
      let fromAccountId: string | undefined;
      let toAccountId: string | undefined;
      
      if (typeInput === 'transfer') {
        const fromAccount = accountMap.get(fromAccountInput);
        const toAccount = accountMap.get(toAccountInput);
        
        if (!fromAccount) {
          errors.push(`Akun sumber transfer "${fromAccountInput}" tidak ditemukan`);
        }
        if (!toAccount) {
          errors.push(`Akun tujuan transfer "${toAccountInput}" tidak ditemukan`);
        }
        
        fromAccountId = fromAccount?.id;
        toAccountId = toAccount?.id;
      } else {
        const category = categoryMap.get(categoryNameInput);
        const account = accountMap.get(accountNameInput);
        
        if (!category) {
          errors.push(`Kategori "${categoryNameInput}" tidak ditemukan`);
        }
        if (!account) {
          errors.push(`Akun "${accountNameInput}" tidak ditemukan`);
        }
        
        categoryId = category?.id;
        accountId = account?.id;
      }
      
      const adminFee = adminFeeStr && adminFeeStr !== '-' ? parseFloat(adminFeeStr) : undefined;
      
      if (errors.length > 0) {
        errorRows.push({ row: rowNum, data: { date: dateInput, description, type: typeInput, category: categoryNameInput, account: accountNameInput, fromaccount: fromAccountInput, toaccount: toAccountInput, amount: amountStr }, error: errors.join('; ') });
      } else {
        validRows.push({
          date: parsedDate!,
          description,
          categoryId,
          accountId,
          categoryName: categoryNameInput,
          accountName: accountNameInput,
          fromAccountId,
          toAccountId,
          fromAccountName: fromAccountInput,
          toAccountName: toAccountInput,
          amount,
          adminFee,
          type: typeInput.toUpperCase() as 'INCOME' | 'EXPENSE' | 'TRANSFER',
        });
      }
    }
    
    return {
      validRows,
      errorRows,
      summary: {
        valid: validRows.length,
        errors: errorRows.length,
        total: dataRows.length,
      },
    };
  }

  private parseDateString(dateStr: string): string | null {
    const isoRegex = /^\d{4}-\d{2}-\d{2}$/;
    const dmyRegex = /^\d{2}\/\d{2}\/\d{4}$/;
    
    if (isoRegex.test(dateStr)) return dateStr;
    if (dmyRegex.test(dateStr)) {
      const [day, month, year] = dateStr.split('/');
      return `${year}-${month}-${day}`;
    }
    return null;
  }

  async importTransactions(
    userId: string,
    transactions: Array<{
      date: string;
      description: string;
      categoryId?: string;
      accountId?: string;
      fromAccountId?: string;
      toAccountId?: string;
      amount: number;
      adminFee?: number;
      type: 'INCOME' | 'EXPENSE' | 'TRANSFER';
    }>
  ) {
    const imported: string[] = [];
    const failed: Array<{ data: Record<string, any>; error: string }> = [];

    await prisma.$transaction(async (tx) => {
      for (const txData of transactions) {
        try {
          await this.createWithTx(tx, userId, {
            date: txData.date,
            description: txData.description,
            categoryId: txData.categoryId,
            accountId: txData.accountId,
            fromAccountId: txData.fromAccountId,
            toAccountId: txData.toAccountId,
            amount: txData.amount,
            adminFee: txData.adminFee,
            type: txData.type,
          });
          imported.push(txData.description);
        } catch (error) {
          failed.push({
            data: txData,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    }, { timeout: 30000 });

    return { imported: imported.length, failed: failed.length, errors: failed };
  }

  private async createWithTx(
    tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
    userId: string,
    input: CreateTransactionInput
  ) {
    if (input.type === 'EXPENSE' && input.categoryId) {
      const budgets = await tx.budget.findMany({
        where: {
          userId,
          categoryId: input.categoryId,
          isActive: true,
        },
      });

      if (budgets.length > 0) {
        const transactionDate = new Date(input.date);
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
      }
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
      const account = await tx.account.findUnique({ where: { id: input.accountId } });
      const currentBalance = Number(account?.balance || 0);
      const newBalance = currentBalance + adjustment;
      await tx.account.update({
        where: { id: input.accountId },
        data: { balance: String(newBalance) },
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

        const goalDec1 = await tx.goal.findUnique({ where: { id: goal.id } });
        await tx.goal.update({
          where: { id: goal.id },
          data: { currentAmount: String(Number(goalDec1!.currentAmount) - input.amount) },
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

            const goalInc1 = await tx.goal.findUnique({ where: { id: goal.id } });
            await tx.goal.update({
              where: { id: goal.id },
              data: { currentAmount: String(Number(goalInc1!.currentAmount) + input.amount) },
            });
          }
        }
      }
    }

    if (input.type === 'TRANSFER' && input.fromAccountId && input.toAccountId) {
      const totalDeduct = Number(input.amount) + adminFee;
      const fromAccount = await tx.account.findUnique({ where: { id: input.fromAccountId } });
      const toAccount = await tx.account.findUnique({ where: { id: input.toAccountId } });
      const fromBalance = Number(fromAccount?.balance || 0) - totalDeduct;
      const toBalance = Number(toAccount?.balance || 0) + Number(input.amount);
      await tx.account.update({
        where: { id: input.fromAccountId },
        data: { balance: String(fromBalance) },
      });
      await tx.account.update({
        where: { id: input.toAccountId },
        data: { balance: String(toBalance) },
      });

      await this.handleAutoContribution(tx, input.toAccountId, input.amount, userId, record.id, new Date(input.date));
    }

    return record;
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

    const goalInc6 = await tx.goal.findUnique({ where: { id: goal.id } });
    await tx.goal.update({
      where: { id: goal.id },
      data: { currentAmount: String(Number(goalInc6!.currentAmount) + amount) },
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

    const effectiveDate = txDate instanceof Date ? txDate : new Date();
    const txMonth = effectiveDate.getMonth();
    const txYear = effectiveDate.getFullYear();
    
    const goalBudget = budgets.find(b => {
      const endDate = new Date(b.endDate);
      return b.category.name === 'Tabungan - ' + goal.name
        && endDate.getMonth() === txMonth
        && endDate.getFullYear() === txYear;
    });

    if (goalBudget) {
      const budgetInc = await tx.budget.findUnique({ where: { id: goalBudget.id } });
      await tx.budget.update({
        where: { id: goalBudget.id },
        data: { spent: String(Number(budgetInc!.spent) + amount) },
      });
    }
  }
}

export const transactionService = new TransactionService();
