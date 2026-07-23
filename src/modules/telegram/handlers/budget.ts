import TelegramBot from 'node-telegram-bot-api';
import { prisma } from '../../../config/prisma.js';
import { formatBudgetUsage } from '../lib/formatter.js';

export class BudgetHandler {
  private bot: TelegramBot;

  constructor(bot: TelegramBot) {
    this.bot = bot;
  }

  async handleBudget(chatId: number): Promise<void> {
    const settings = await prisma.telegramSettings.findUnique({
      where: { telegramChatId: String(chatId) },
      include: {
        user: {
          include: {
            budgets: {
              where: { isActive: true },
              include: { category: true },
            },
          },
        },
      },
    });

    if (!settings?.isLinked) {
      await this.bot.sendMessage(chatId, '🔗 Akun belum terhubung.');
      return;
    }

    const budgets = settings.user.budgets.map(b => ({
      id: b.id,
      categoryName: b.category.name,
      amount: b.amount,
      spent: b.spent,
    }));

    await this.bot.sendMessage(chatId, formatBudgetUsage(budgets), { parse_mode: 'Markdown' });
  }
}
