import TelegramBot from 'node-telegram-bot-api';
import { prisma } from '../../../config/prisma.js';
import { formatGoalProgress } from '../lib/formatter.js';

export class GoalsHandler {
  private bot: TelegramBot;

  constructor(bot: TelegramBot) {
    this.bot = bot;
  }

  async handleGoals(chatId: number): Promise<void> {
    const settings = await prisma.telegramSettings.findUnique({
      where: { telegramChatId: String(chatId) },
      include: {
        user: {
          include: {
            goals: {
              where: { status: 'ACTIVE' },
              orderBy: { deadline: 'asc' },
            },
          },
        },
      },
    });

    if (!settings?.isLinked) {
      await this.bot.sendMessage(chatId, '🔗 Akun belum terhubung.');
      return;
    }

    const goals = settings.user.goals.map(g => ({
      id: g.id,
      name: g.name,
      targetAmount: g.targetAmount,
      currentAmount: g.currentAmount,
      deadline: g.deadline,
      icon: g.icon,
      color: g.color,
    }));

    await this.bot.sendMessage(chatId, formatGoalProgress(goals), { parse_mode: 'Markdown' });
  }
}
