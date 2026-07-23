import TelegramBot from 'node-telegram-bot-api';
import { prisma } from '../../../config/prisma.js';
import { formatWeeklySummary, formatCurrency } from '../lib/formatter.js';
import { startOfDay, endOfDay, subDays, startOfMonth, endOfMonth, format } from 'date-fns';
import { decrypt } from '../../../utils/encryption.js';

function decryptAmount(value: string | number): number {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return 0;
  if (value.startsWith('$enc$')) {
    try {
      return parseFloat(decrypt(value)) || 0;
    } catch {
      return 0;
    }
  }
  return parseFloat(value) || 0;
}

export class SummaryHandler {
  private bot: TelegramBot;

  constructor(bot: TelegramBot) {
    this.bot = bot;
  }

  async handleSummary(chatId: number): Promise<void> {
    const settings = await prisma.telegramSettings.findUnique({
      where: { telegramChatId: String(chatId) },
      include: {
        user: {
          include: {
            accounts: { where: { isArchived: false } },
            transactions: {
              where: {
                date: { gte: subDays(new Date(), 7) },
              },
              include: { category: true },
            },
            goals: { where: { status: 'ACTIVE' } },
            budgets: { where: { isActive: true }, include: { category: true } },
          },
        },
      },
    });

    if (!settings?.isLinked) {
      await this.bot.sendMessage(chatId, '🔗 Akun belum terhubung.');
      return;
    }

    const user = settings.user;
    const transactions = user.transactions;
    const goals = user.goals;
    const budgets = user.budgets;
    const accounts = user.accounts;

    let income = 0;
    let expense = 0;
    const categoryMap = new Map<string, number>();

    for (const tx of transactions) {
      const amount = decryptAmount(tx.amount);
      if (tx.type === 'INCOME') income += amount;
      else if (tx.type === 'EXPENSE') {
        expense += amount;
        const catName = tx.category?.name || 'Lainnya';
        categoryMap.set(catName, (categoryMap.get(catName) || 0) + amount);
      }
    }

    const topCategories = Array.from(categoryMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, amount]) => ({ name, amount: String(amount) }));

    const accountBalances = accounts.map(a => ({
      name: a.name,
      balance: a.balance,
    }));

    const summaryData = {
      period: '7 Hari Terakhir',
      income: String(income),
      expense: String(expense),
      netChange: String(income - expense),
      topCategories,
      accountBalances,
    };

    const summaryText = formatWeeklySummary(summaryData);

    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    let budgetText = '\n\n📋 *Budget Bulan Ini:*\n';
    for (const budget of budgets) {
      const spent = parseFloat(budget.spent);
      const amount = parseFloat(budget.amount);
      const percentage = amount > 0 ? Math.min((spent / amount) * 100, 100) : 0;
      budgetText += `• ${budget.category.name}: ${formatCurrency(spent)} / ${formatCurrency(amount)} (${percentage.toFixed(0)}%)\n`;
    }

    let goalsText = '\n\n🎯 *Goals Progress:*\n';
    for (const goal of goals) {
      const current = parseFloat(goal.currentAmount);
      const target = parseFloat(goal.targetAmount);
      const progress = target > 0 ? Math.min((current / target) * 100, 100) : 0;
      goalsText += `• ${goal.name}: ${progress.toFixed(0)}% (${formatCurrency(current)} / ${formatCurrency(target)})\n`;
    }

    const bills = await prisma.bill.findMany({
      where: {
        userId: settings.userId,
        isActive: true,
      },
    });

    const upcomingBills = bills.filter(b => {
      const dueDay = b.dueDate;
      const today = now.getDate();
      const daysUntilDue = dueDay >= today ? dueDay - today : dueDay + (30 - today);
      return daysUntilDue <= 7;
    });

    let billsText = '';
    if (upcomingBills.length > 0) {
      billsText = '\n\n📅 *Bill Akan Jatuh Tempo:*\n';
      for (const bill of upcomingBills) {
        const dueDay = bill.dueDate;
        const today = now.getDate();
        let daysUntilDue = dueDay >= today ? dueDay - today : dueDay + (30 - today);
        if (daysUntilDue === 0) daysUntilDue = 7;
        billsText += `• ${bill.name}: ${formatCurrency(bill.amount)} (${daysUntilDue} hari lagi)\n`;
      }
    }

    await this.bot.sendMessage(chatId, summaryText + budgetText + goalsText + billsText, {
      parse_mode: 'Markdown',
    });
  }
}
