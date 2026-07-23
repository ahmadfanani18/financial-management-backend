import TelegramBot from 'node-telegram-bot-api';
import { config } from '../../config/index.js';
import type { FastifyInstance } from 'fastify';
import { startNotificationScheduler } from './notifications/scheduler.js';

let botInstance: TelegramBot | null = null;

export function getBot(): TelegramBot | null {
  return botInstance;
}

export async function registerTelegram(app: FastifyInstance): Promise<void> {
  const token = config.telegramBotToken;

  if (!token) {
    console.warn('TELEGRAM_BOT_TOKEN not configured, Telegram bot disabled');
    return;
  }

  const mode = config.telegramMode || 'polling';

  if (mode === 'webhook') {
    botInstance = new TelegramBot(token, { webHook: true });
    const webhookUrl = config.telegramWebhookUrl;

    if (webhookUrl) {
      await botInstance.setWebHook(webhookUrl);
      console.log(`Telegram bot webhook set to ${webhookUrl}`);
    }
  } else {
    botInstance = new TelegramBot(token, { polling: true });
  }

  const { TelegramController } = await import('./controller.js');
  const telegramController = new TelegramController(botInstance);

  startNotificationScheduler();

  console.log(`Telegram bot started in ${mode} mode`);
}
