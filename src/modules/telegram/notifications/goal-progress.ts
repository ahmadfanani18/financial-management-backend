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

const MILESTONES = [25, 50, 75, 100];

export async function sendGoalProgress(
  bot: TelegramBot,
  chatId: string,
  userId: string
): Promise<void> {
  const goals = await prisma.goal.findMany({
    where: { userId, status: 'ACTIVE' },
  });

  if (!goals.length) return;

  for (const goal of goals) {
    const current = decryptAmount(goal.currentAmount);
    const target = decryptAmount(goal.targetAmount);
    const progress = target > 0 ? (current / target) * 100 : 0;

    for (const milestone of MILESTONES) {
      if (progress >= milestone) {
        const milestoneKey = `${goal.id}-${milestone}`;
        const existing = await prisma.notification.findFirst({
          where: {
            userId,
            type: 'GOAL_MILESTONE',
            message: { contains: milestoneKey },
          },
        });

        if (!existing) {
          await prisma.notification.create({
            data: {
              userId,
              type: 'GOAL_MILESTONE',
              title: 'Goal Milestone',
              message: `[${milestoneKey}] ${goal.icon} *${goal.name}* reached ${milestone}%!\n${formatCurrency(current)} / ${formatCurrency(target)}`,
            },
          });

          await bot.sendMessage(chatId,
            `🎯 *Milestone Achieved!*\n\n` +
            `${goal.icon} *${goal.name}*\n` +
            `${progress.toFixed(0)}% complete\n` +
            `${formatCurrency(current)} / ${formatCurrency(target)}`,
            { parse_mode: 'Markdown' }
          );
          return;
        }
      }
    }
  }
}
