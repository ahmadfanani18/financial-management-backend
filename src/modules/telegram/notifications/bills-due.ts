import TelegramBot from 'node-telegram-bot-api';
import { prisma } from '../../../config/prisma.js';
import { decrypt } from '../../../utils/encryption.js';
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

export async function sendBillsDueReminder(
  bot: TelegramBot,
  chatId: string,
  userId: string
): Promise<void> {
  const bills = await prisma.bill.findMany({
    where: { userId, isActive: true },
    include: { account: true },
  });

  if (!bills.length) return;

  const now = new Date();
  const today = now.getDate();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const reminders: { name: string; amount: number; daysUntil: number; billId: string }[] = [];

  for (const bill of bills) {
    let daysUntil = bill.dueDate >= today
      ? bill.dueDate - today
      : bill.dueDate + (30 - today);

    if (daysUntil === 1) {
      const alreadySent = await prisma.notification.findFirst({
        where: {
          userId,
          type: 'BILL_REMINDER',
          billId: bill.id,
          createdAt: { gte: startOfDay, lt: endOfDay },
        },
      });
      if (alreadySent) continue;

      reminders.push({
        name: bill.name,
        amount: decryptAmount(bill.amount),
        daysUntil,
        billId: bill.id,
      });
    }
  }

  if (reminders.length === 0) return;

  reminders.sort((a, b) => a.daysUntil - b.daysUntil);

  const lines = reminders.map(b =>
    `• ${b.name}: ${formatCurrency(b.amount)} (${b.daysUntil} hari)`
  );

  const message = `📅 *Reminder Bill*\n\n${lines.join('\n')}`;
  await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
}
