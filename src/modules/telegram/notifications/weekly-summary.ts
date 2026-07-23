import TelegramBot from 'node-telegram-bot-api';
import { prisma } from '../../../config/prisma.js';
import { decrypt } from '../../../utils/encryption.js';
import { formatCurrency } from '../lib/formatter.js';
import { startOfWeek, endOfWeek, subDays, subWeeks, format } from 'date-fns';

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

export async function sendWeeklySummary(
  bot: TelegramBot,
  chatId: string,
  userId: string
): Promise<void> {
  const now = new Date();
  const currentWeekStart = startOfWeek(now, { weekStartsOn: 1 });
  const currentWeekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const previousWeekStart = subWeeks(currentWeekStart, 1);
  const previousWeekEnd = subDays(currentWeekStart, 1);

  const [currentTx, previousTx, budgets, goals, bills] = await Promise.all([
    prisma.transaction.findMany({
      where: { userId, date: { gte: currentWeekStart, lte: currentWeekEnd } },
      include: { category: true },
    }),
    prisma.transaction.findMany({
      where: { userId, date: { gte: previousWeekStart, lte: previousWeekEnd } },
    }),
    prisma.budget.findMany({
      where: { userId, isActive: true },
      include: { category: true },
    }),
    prisma.goal.findMany({
      where: { userId, status: 'ACTIVE' },
    }),
    prisma.bill.findMany({
      where: { userId, isActive: true },
    }),
  ]);

  let currentIncome = 0;
  let currentExpense = 0;
  const categoryMap = new Map<string, number>();

  for (const tx of currentTx) {
    const amount = decryptAmount(tx.amount);
    if (tx.type === 'INCOME') currentIncome += amount;
    else if (tx.type === 'EXPENSE') {
      currentExpense += amount;
      const catName = tx.category?.name || 'Lainnya';
      categoryMap.set(catName, (categoryMap.get(catName) || 0) + amount);
    }
  }

  let previousExpense = 0;
  for (const tx of previousTx) {
    if (tx.type === 'EXPENSE') {
      previousExpense += decryptAmount(tx.amount);
    }
  }

  const topCategories = Array.from(categoryMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, amount]) => ({ name, amount }));

  const expenseChange = previousExpense > 0
    ? ((currentExpense - previousExpense) / previousExpense) * 100
    : 0;

  const today = now.getDate();
  const upcomingBills = bills.filter(b => {
    let daysUntil = b.dueDate >= today ? b.dueDate - today : b.dueDate + (30 - today);
    return daysUntil <= 7;
  });

  const budgetAlerts: string[] = [];
  for (const budget of budgets) {
    const spent = decryptAmount(budget.spent);
    const amount = decryptAmount(budget.amount);
    const percentage = amount > 0 ? (spent / amount) * 100 : 0;
    if (percentage >= 75) {
      budgetAlerts.push(`${budget.category.name}: ${percentage.toFixed(0)}%`);
    }
  }

  const goalProgress: string[] = [];
  for (const goal of goals) {
    const current = decryptAmount(goal.currentAmount);
    const target = decryptAmount(goal.targetAmount);
    const progress = target > 0 ? (current / target) * 100 : 0;
    goalProgress.push(`${goal.icon} ${goal.name}: ${progress.toFixed(0)}%`);
  }

  const weekLabel = format(currentWeekStart, 'd MMM') + ' - ' + format(currentWeekEnd, 'd MMM yyyy');

  let message = `📊 *Ringkasan Mingguan*\n_${weekLabel}_\n\n`;
  message += `📥 Pemasukan: ${formatCurrency(currentIncome)}\n`;
  message += `📤 Pengeluaran: ${formatCurrency(currentExpense)} `;
  message += `(${expenseChange >= 0 ? '📈' : '📉'} ${Math.abs(expenseChange).toFixed(0)}%)\n\n`;

  if (topCategories.length) {
    message += `🛍️ Top Kategori:\n`;
    for (const cat of topCategories) {
      message += `  • ${cat.name}: ${formatCurrency(decryptAmount(String(cat.amount)))}\n`;
    }
    message += '\n';
  }

  if (budgetAlerts.length) {
    message += `⚠️ *Budget Warning:*\n`;
    for (const alert of budgetAlerts) {
      message += `  • ${alert}\n`;
    }
    message += '\n';
  }

  if (goalProgress.length) {
    message += `🎯 *Goals:*\n`;
    for (const g of goalProgress) {
      message += `  • ${g}\n`;
    }
    message += '\n';
  }

  if (upcomingBills.length) {
    message += `📅 *Bill Akan Jatuh Tempo:*\n`;
    for (const bill of upcomingBills) {
      let daysUntil = bill.dueDate >= today ? bill.dueDate - today : bill.dueDate + (30 - today);
      if (daysUntil === 0) daysUntil = 7;
      message += `  • ${bill.name}: ${formatCurrency(decryptAmount(bill.amount))} (${daysUntil} hari)\n`;
    }
  }

  await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
}
