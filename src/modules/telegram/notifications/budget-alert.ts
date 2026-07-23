import TelegramBot from 'node-telegram-bot-api';
import { prisma } from '../../../config/prisma.js';
import { decrypt } from '../../../utils/encryption.js';
import { startOfMonth, endOfMonth } from 'date-fns';
import { formatCurrency } from '../lib/formatter.js';

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

export async function sendBudgetAlert(
  bot: TelegramBot,
  chatId: string,
  userId: string
): Promise<void> {
  const budgets = await prisma.budget.findMany({
    where: { userId, isActive: true },
    include: { category: true },
  });

  if (!budgets.length) return;

  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const transactions = await prisma.transaction.findMany({
    where: {
      userId,
      type: 'EXPENSE',
      date: { gte: monthStart, lte: monthEnd },
    },
  });

  const alerts: string[] = [];

  for (const budget of budgets) {
    const spentInMonth = transactions
      .filter(tx => tx.categoryId === budget.categoryId)
      .reduce((sum, tx) => sum + decryptAmount(tx.amount), 0);

    const budgetAmount = decryptAmount(budget.amount);
    const percentage = budgetAmount > 0 ? (spentInMonth / budgetAmount) * 100 : 0;

    if (percentage >= 80) {
      const emoji = percentage >= 100 ? '🔴' : '🟡';
      alerts.push(
        `${emoji} *${budget.category.name}*\n` +
        `${formatCurrency(spentInMonth)} / ${formatCurrency(budgetAmount)} (${percentage.toFixed(0)}%)`
      );
    }
  }

  if (alerts.length > 0) {
    const message = `⚠️ *Budget Warning*\n\n${alerts.join('\n\n')}`;
    await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
  }
}
