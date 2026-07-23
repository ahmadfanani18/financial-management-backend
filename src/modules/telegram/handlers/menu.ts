import TelegramBot from 'node-telegram-bot-api';
import { prisma } from '../../../config/prisma.js';
import {
  mainMenuKeyboard,
  settingsKeyboard,
  notificationSettingsKeyboard,
  backToMenuKeyboard,
} from '../lib/keyboard.js';

export class MenuHandler {
  private bot: TelegramBot;

  constructor(bot: TelegramBot) {
    this.bot = bot;
  }

  async showMenu(chatId: number): Promise<void> {
    await this.bot.sendMessage(chatId, '📋 *Menu Utama*', {
      parse_mode: 'Markdown',
      reply_markup: mainMenuKeyboard(),
    });
  }

  async showHelp(chatId: number): Promise<void> {
    const text = `📖 *Panduan Bot*

*Perintah:*
/start - Memulai bot
/menu - Menu utama
/help - Bantuan ini
/saldo - Saldo semua akun
/mutasi [periode] - Mutasi akun
/transaksi [periode] - Daftar transaksi
/goals - Daftar goals
/budget - Penggunaan budget
/ask [pertanyaan] - Tanya ke AI
/summary - Ringkasan mingguan
/unlink - Putuskan Telegram

*Periode (untuk mutasi & transaksi):*
- hari ini, kemarin, minggu ini
- bulan ini, bulan lalu
- "juli 2026"
- "1 juli 2026 sampai 31 juli 2026"`;

    await this.bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
  }

  async handleCallback(chatId: number, action: string, messageId?: number): Promise<void> {
    switch (action) {
      case 'main':
      case 'back':
        await this.showMenu(chatId);
        break;
      case 'saldo':
        await this.bot.sendMessage(chatId, '💰 Fitur saldo dipanggil dari menu.');
        break;
      case 'mutasi':
        await this.bot.sendMessage(chatId, '📊 Fitur mutasi dipanggil dari menu.');
        break;
      case 'transaksi':
        await this.bot.sendMessage(chatId, '💳 Fitur transaksi dipanggil dari menu.');
        break;
      case 'goals':
        await this.bot.sendMessage(chatId, '🎯 Fitur goals dipanggil dari menu.');
        break;
      case 'budget':
        await this.bot.sendMessage(chatId, '📋 Fitur budget dipanggil dari menu.');
        break;
      case 'ask':
        await this.bot.sendMessage(chatId, '📝 Fitur tanya AI dipanggil dari menu.');
        break;
      case 'summary':
        await this.bot.sendMessage(chatId, '📈 Fitur ringkasan dipanggil dari menu.');
        break;
      case 'settings':
        await this.handleSettingsCallback(chatId, 'show', messageId);
        break;
      default:
        await this.showMenu(chatId);
    }
  }

  async handleSettingsCallback(chatId: number, action: string, messageId?: number): Promise<void> {
    const settings = await prisma.telegramSettings.findUnique({
      where: { telegramChatId: String(chatId) },
    });

    if (action === 'show') {
      const text = '⚙️ *Pengaturan*';
      const replyMarkup = settingsKeyboard(settings?.isLinked ?? false);
      
      if (messageId) {
        await this.bot.editMessageText(text, {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: 'Markdown',
          reply_markup: replyMarkup,
        });
      } else {
        await this.bot.sendMessage(chatId, text, {
          parse_mode: 'Markdown',
          reply_markup: replyMarkup,
        });
      }
    } else if (action === 'notifications') {
      if (settings) {
        const notif = settings.notifications as Record<string, unknown>;
        const text = '🔔 *Pengaturan Notifikasi*';
        const replyMarkup = notificationSettingsKeyboard({
          budgetAlert: Boolean(notif.budgetAlert),
          goalProgress: Boolean(notif.goalProgress),
          weeklySummary: Boolean(notif.weeklySummary),
          weeklySummaryDay: Number(notif.weeklySummaryDay),
          weeklySummaryTime: String(notif.weeklySummaryTime),
          billsDue: Boolean(notif.billsDue),
        });

        if (messageId) {
          await this.bot.editMessageText(text, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            reply_markup: replyMarkup,
          });
        } else {
          await this.bot.sendMessage(chatId, text, {
            parse_mode: 'Markdown',
            reply_markup: replyMarkup,
          });
        }
      }
    }
  }

  async handleNotificationToggle(chatId: number, key: string, messageId?: number): Promise<void> {
    const settings = await prisma.telegramSettings.findUnique({
      where: { telegramChatId: String(chatId) },
    });

    if (settings) {
      const notif = settings.notifications as Record<string, unknown>;
      notif[key] = !notif[key];
      
      await prisma.telegramSettings.update({
        where: { id: settings.id },
        data: { notifications: notif as object },
      });

      const text = '🔔 *Pengaturan Notifikasi*';
      const replyMarkup = notificationSettingsKeyboard({
        budgetAlert: Boolean(notif.budgetAlert),
        goalProgress: Boolean(notif.goalProgress),
        weeklySummary: Boolean(notif.weeklySummary),
        weeklySummaryDay: Number(notif.weeklySummaryDay),
        weeklySummaryTime: String(notif.weeklySummaryTime),
        billsDue: Boolean(notif.billsDue),
      });

      if (messageId) {
        await this.bot.editMessageText(text, {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: 'Markdown',
          reply_markup: replyMarkup,
        });
      } else {
        await this.bot.sendMessage(chatId, text, {
          parse_mode: 'Markdown',
          reply_markup: replyMarkup,
        });
      }
    }
  }
}
