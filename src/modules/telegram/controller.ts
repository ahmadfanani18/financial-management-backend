import TelegramBot, { Message, CallbackQuery } from 'node-telegram-bot-api';
import { prisma } from '../../config/prisma.js';
import { parseDate, formatDateRange } from './lib/date-parser.js';
import {
  mainMenuKeyboard,
  accountSelectionKeyboard,
  periodSelectionKeyboard,
  confirmUnlinkKeyboard,
  backToMenuKeyboard,
  settingsKeyboard,
  notificationSettingsKeyboard,
  daySelectionKeyboard,
  timeSelectionKeyboard,
} from './lib/keyboard.js';
import {
  formatCurrency,
  formatAccountBalance,
  formatGoalProgress,
  formatBudgetUsage,
  formatTransactionList,
  formatWeeklySummary,
} from './lib/formatter.js';
import { decrypt } from '../../utils/encryption.js';
import { AIHandler } from './handlers/ai.js';

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

export class TelegramController {
  private bot: TelegramBot;
  private userStates: Map<number, { step: string; data?: Record<string, unknown> }> = new Map();
  private aiHandler: AIHandler;

  constructor(bot: TelegramBot) {
    this.bot = bot;
    this.aiHandler = new AIHandler(bot);
    this.registerHandlers();
  }

  private registerHandlers(): void {
    this.bot.onText(/\/start/, (msg) => this.onStart(msg));
    this.bot.onText(/\/menu/, (msg) => this.onMenu(msg));
    this.bot.onText(/\/help/, (msg) => this.onHelp(msg));
    this.bot.onText(/\/saldo/, (msg) => this.onSaldo(msg));
    this.bot.onText(/\/mutasi/, (msg) => this.onMutasi(msg));
    this.bot.onText(/\/transaksi/, (msg) => this.onTransaksi(msg));
    this.bot.onText(/\/goals/, (msg) => this.onGoals(msg));
    this.bot.onText(/\/budget/, (msg) => this.onBudget(msg));
    this.bot.onText(/\/ask (.+)/, (msg, match) => this.onAsk(msg, match?.[1]));
    this.bot.onText(/\/summary/, (msg) => this.onSummary(msg));
    this.bot.onText(/\/unlink/, (msg) => this.onUnlink(msg));

    this.bot.on('callback_query', (query) => this.onCallbackQuery(query));

    this.bot.on('message', (msg) => this.onMessage(msg));
  }

  private async onStart(msg: Message): Promise<void> {
    const chatId = msg.chat.id;
    const text = `👋 Selamat datang di Financial Management Bot!

Gunakan menu di bawah atau ketik perintah:
/menu - Tampilkan menu utama
/help - Bantuan
/saldo - Lihat saldo akun
/mutasi - Lihat mutasi
/transaksi - Lihat transaksi
/goals - Lihat goals
/budget - Lihat budget
/ask [pertanyaan] - Tanya AI
/summary - Ringkasan mingguan
/unlink - Putuskan koneksi Telegram`;

    await this.bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
  }

  private async onMenu(msg: Message): Promise<void> {
    const chatId = msg.chat.id;
    await this.bot.sendMessage(chatId, '📋 *Menu Utama*', {
      parse_mode: 'Markdown',
      reply_markup: mainMenuKeyboard(),
    });
  }

  private async onHelp(msg: Message): Promise<void> {
    const chatId = msg.chat.id;
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

  private async onSaldo(msg: Message): Promise<void> {
    const chatId = msg.chat.id;

    const settings = await prisma.telegramSettings.findUnique({
      where: { telegramChatId: String(chatId) },
      include: { user: { include: { accounts: true } } },
    });

    if (!settings?.isLinked) {
      await this.bot.sendMessage(chatId, '🔗 Akun belum terhubung. Hubungkan melalui aplikasi web.');
      return;
    }

    const accounts = settings.user.accounts.filter(a => !a.isArchived);
    await this.bot.sendMessage(chatId, formatAccountBalance(accounts), { parse_mode: 'Markdown' });
  }

  private async onMutasi(msg: Message): Promise<void> {
    const chatId = msg.chat.id;
    await this.bot.sendMessage(chatId, 'Pilih periode untuk melihat mutasi:', {
      reply_markup: periodSelectionKeyboard(),
    });
  }

  private async onTransaksi(msg: Message): Promise<void> {
    const chatId = msg.chat.id;
    await this.bot.sendMessage(chatId, 'Pilih periode untuk melihat transaksi:', {
      reply_markup: periodSelectionKeyboard(),
    });
  }

  private async onGoals(msg: Message): Promise<void> {
    const chatId = msg.chat.id;

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

  private async onBudget(msg: Message): Promise<void> {
    const chatId = msg.chat.id;

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

  private async onAsk(msg: Message, query?: string): Promise<void> {
    const chatId = msg.chat.id;

    if (!query) {
      await this.bot.sendMessage(chatId, '❓ Silakan ajukan pertanyaan. Contoh: /ask berapa pengeluaran saya bulan ini?');
      return;
    }

    const settings = await prisma.telegramSettings.findUnique({
      where: { telegramChatId: String(chatId) },
    });

    if (!settings?.isLinked) {
      await this.bot.sendMessage(chatId, '🔗 Akun belum terhubung.');
      return;
    }

    await this.aiHandler.handleAsk(chatId, query);
  }

  private async onSummary(msg: Message): Promise<void> {
    const chatId = msg.chat.id;

    const settings = await prisma.telegramSettings.findUnique({
      where: { telegramChatId: String(chatId) },
      include: {
        user: {
          include: {
            accounts: { where: { isArchived: false } },
            transactions: {
              where: {
                date: {
                  gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
                },
              },
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

    const transactions = settings.user.transactions;
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

    const summaryData = {
      period: '7 Hari Terakhir',
      income: String(income),
      expense: String(expense),
      netChange: String(income - expense),
      topCategories,
      accountBalances: settings.user.accounts.map(a => ({
        name: a.name,
        balance: a.balance,
      })),
    };

    await this.bot.sendMessage(chatId, formatWeeklySummary(summaryData), { parse_mode: 'Markdown' });
  }

  private async onUnlink(msg: Message): Promise<void> {
    const chatId = msg.chat.id;

    const settings = await prisma.telegramSettings.findUnique({
      where: { telegramChatId: String(chatId) },
    });

    if (!settings?.isLinked) {
      await this.bot.sendMessage(chatId, '🔗 Akun Telegram belum terhubung.');
      return;
    }

    await this.bot.sendMessage(chatId, '⚠️ Apakah Anda yakin ingin memutuskan koneksi Telegram?', {
      reply_markup: confirmUnlinkKeyboard(),
    });
  }

  private async onCallbackQuery(query: CallbackQuery): Promise<void> {
    const chatId = query.message?.chat.id;
    const data = query.data;

    if (!chatId || !data) return;

    try {
      await this.bot.answerCallbackQuery(query.id);
    } catch (err: any) {
      if (err?.message?.includes('query is too old')) {
        return;
      }
      console.error('answerCallbackQuery error:', err);
    }

    if (data === 'menu:main' || data === 'menu:back') {
      await this.bot.editMessageText('📋 *Menu Utama*', {
        chat_id: chatId,
        message_id: query.message?.message_id,
        parse_mode: 'Markdown',
        reply_markup: mainMenuKeyboard(),
      });
    } else if (data === 'menu:saldo') {
      await this.onSaldo(query.message!);
    } else if (data === 'menu:mutasi') {
      await this.onMutasi(query.message!);
    } else if (data === 'menu:transaksi') {
      await this.onTransaksi(query.message!);
    } else if (data === 'menu:goals') {
      await this.onGoals(query.message!);
    } else if (data === 'menu:budget') {
      await this.onBudget(query.message!);
    } else if (data === 'menu:ask') {
      await this.bot.sendMessage(chatId, '🤖 Ketik /ask [pertanyaan] untuk bertanya ke AI.\n\nContoh: /ask berapa pengeluaran saya bulan ini?');
    } else if (data === 'menu:summary') {
      await this.onSummary(query.message!);
    } else if (data === 'menu:settings' || data === 'settings:show') {
      const settings = await prisma.telegramSettings.findUnique({
        where: { telegramChatId: String(chatId) },
      });
      await this.bot.editMessageText('⚙️ *Pengaturan*', {
        chat_id: chatId,
        message_id: query.message?.message_id,
        parse_mode: 'Markdown',
        reply_markup: settingsKeyboard(settings?.isLinked ?? false),
      });
    } else if (data === 'settings:notifications') {
      const settings = await prisma.telegramSettings.findUnique({
        where: { telegramChatId: String(chatId) },
      });
      if (settings) {
        const notif = settings.notifications as Record<string, unknown>;
        await this.bot.editMessageText('🔔 *Pengaturan Notifikasi*', {
          chat_id: chatId,
          message_id: query.message?.message_id,
          parse_mode: 'Markdown',
          reply_markup: notificationSettingsKeyboard({
            budgetAlert: Boolean(notif.budgetAlert),
            goalProgress: Boolean(notif.goalProgress),
            weeklySummary: Boolean(notif.weeklySummary),
            weeklySummaryDay: Number(notif.weeklySummaryDay),
            weeklySummaryTime: String(notif.weeklySummaryTime),
            billsDue: Boolean(notif.billsDue),
          }),
        });
      }
    } else if (data === 'settings:unlink') {
      await this.bot.editMessageText('⚠️ Apakah Anda yakin ingin memutuskan koneksi Telegram?', {
        chat_id: chatId,
        message_id: query.message?.message_id,
        reply_markup: confirmUnlinkKeyboard(),
      });
    } else if (data === 'unlink:confirm') {
      await prisma.telegramSettings.update({
        where: { telegramChatId: String(chatId) },
        data: { isLinked: false, telegramChatId: null },
      });
      await this.bot.editMessageText('✅ Koneksi Telegram telah diputuskan.', {
        chat_id: chatId,
        message_id: query.message?.message_id,
      });
    } else if (data.startsWith('period:')) {
      const period = data.replace('period:', '');
      let dateRange;

      if (period === 'today') dateRange = parseDate('hari ini');
      else if (period === 'week') dateRange = parseDate('minggu ini');
      else if (period === 'month') dateRange = parseDate('bulan ini');
      else if (period === 'last_month') dateRange = parseDate('bulan lalu');
      else dateRange = null;

      if (dateRange) {
        const settings = await prisma.telegramSettings.findUnique({
          where: { telegramChatId: String(chatId) },
          include: {
            user: {
              include: {
                accounts: true,
                transactions: {
                  where: { date: { gte: dateRange.start, lte: dateRange.end } },
                  include: { category: true },
                  orderBy: { date: 'desc' },
                },
              },
            },
          },
        });

        if (settings) {
          const transactions = settings.user.transactions.map(tx => ({
            id: tx.id,
            type: tx.type,
            amount: tx.amount,
            description: tx.description,
            date: tx.date,
            categoryName: tx.category?.name,
          }));

          const text = `📊 Mutasi ${formatDateRange(dateRange)}\n\n${formatTransactionList(transactions)}`;
          await this.bot.sendMessage(chatId, text, {
            parse_mode: 'Markdown',
            reply_markup: backToMenuKeyboard(),
          });
        }
      }
    } else if (data.startsWith('notif:')) {
      const notifType = data.replace('notif:', '');
      const settings = await prisma.telegramSettings.findUnique({
        where: { telegramChatId: String(chatId) },
      });

      if (!settings) return;

      const notif = settings.notifications as Record<string, unknown>;

      // Handle day selection
      if (notifType === 'summaryDay') {
        await this.bot.editMessageText('📅 *Pilih Hari*\n\nPilih hari untuk mengirim weekly summary:', {
          chat_id: chatId,
          message_id: query.message?.message_id,
          parse_mode: 'Markdown',
          reply_markup: daySelectionKeyboard(Number(notif.weeklySummaryDay) || 0),
        });
        return;
      }

      // Handle time selection - ask for custom input
      if (notifType === 'summaryTime') {
        await this.bot.editMessageText('🕐 *Set Waktu*\n\nKirim waktu baru dengan format HH:MM\nContoh: 14:30', {
          chat_id: chatId,
          message_id: query.message?.message_id,
          parse_mode: 'Markdown',
        });
        // Store state that we're waiting for time input
        this.userStates.set(chatId, { step: 'waiting_summary_time' });
        return;
      }

      // Handle day_X - set day
      if (notifType.startsWith('day_')) {
        const day = parseInt(notifType.replace('day_', ''));
        notif.weeklySummaryDay = day;
        await prisma.telegramSettings.update({
          where: { id: settings.id },
          data: { notifications: notif as object },
        });
        await this.bot.editMessageText('🔔 *Pengaturan Notifikasi*', {
          chat_id: chatId,
          message_id: query.message?.message_id,
          parse_mode: 'Markdown',
          reply_markup: notificationSettingsKeyboard({
            budgetAlert: Boolean(notif.budgetAlert),
            goalProgress: Boolean(notif.goalProgress),
            weeklySummary: Boolean(notif.weeklySummary),
            weeklySummaryDay: Number(notif.weeklySummaryDay),
            weeklySummaryTime: String(notif.weeklySummaryTime),
            billsDue: Boolean(notif.billsDue),
          }),
        });
        return;
      }

      // Handle time_XX:XX - set time
      if (notifType.startsWith('time_')) {
        const time = notifType.replace('time_', '');
        notif.weeklySummaryTime = time;
        await prisma.telegramSettings.update({
          where: { id: settings.id },
          data: { notifications: notif as object },
        });
        await this.bot.editMessageText('🔔 *Pengaturan Notifikasi*', {
          chat_id: chatId,
          message_id: query.message?.message_id,
          parse_mode: 'Markdown',
          reply_markup: notificationSettingsKeyboard({
            budgetAlert: Boolean(notif.budgetAlert),
            goalProgress: Boolean(notif.goalProgress),
            weeklySummary: Boolean(notif.weeklySummary),
            weeklySummaryDay: Number(notif.weeklySummaryDay),
            weeklySummaryTime: String(notif.weeklySummaryTime),
            billsDue: Boolean(notif.billsDue),
          }),
        });
        return;
      }

      // Toggle existing notifications
      if (['budgetAlert', 'goalProgress', 'weeklySummary', 'billsDue'].includes(notifType)) {
        notif[notifType] = !notif[notifType];
        await prisma.telegramSettings.update({
          where: { id: settings.id },
          data: { notifications: notif as object },
        });

        await this.bot.editMessageText('🔔 *Pengaturan Notifikasi*', {
          chat_id: chatId,
          message_id: query.message?.message_id,
          parse_mode: 'Markdown',
          reply_markup: notificationSettingsKeyboard({
            budgetAlert: Boolean(notif.budgetAlert),
            goalProgress: Boolean(notif.goalProgress),
            weeklySummary: Boolean(notif.weeklySummary),
            weeklySummaryDay: Number(notif.weeklySummaryDay),
            weeklySummaryTime: String(notif.weeklySummaryTime),
            billsDue: Boolean(notif.billsDue),
          }),
        });
      }
    }
  }

  private async onMessage(msg: Message): Promise<void> {
    const chatId = msg.chat.id;
    const text = msg.text?.trim();

    if (!text || msg.entities?.some(e => e.type === 'bot_command')) return;

    // Check if waiting for time input
    const state = this.userStates.get(chatId);
    if (state?.step === 'waiting_summary_time') {
      this.userStates.delete(chatId);
      await this.handleSummaryTimeInput(msg, text);
      return;
    }

    if (/^\d{6}$/.test(text)) {
      await this.onVerifyCode(msg, text);
    }
  }

  private async handleSummaryTimeInput(msg: Message, input: string): Promise<void> {
    const chatId = msg.chat.id;
    const timeMatch = input.match(/^(\d{1,2}):(\d{2})$/);

    if (!timeMatch) {
      await this.bot.sendMessage(chatId, '❌ Format tidak valid. Gunakan format HH:MM\nContoh: 14:30');
      return;
    }

    const hours = parseInt(timeMatch[1]);
    const minutes = parseInt(timeMatch[2]);

    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      await this.bot.sendMessage(chatId, '❌ Waktu tidak valid. Jam 0-23, Menit 00-59');
      return;
    }

    const timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;

    const settings = await prisma.telegramSettings.findUnique({
      where: { telegramChatId: String(chatId) },
    });

    if (!settings) {
      await this.bot.sendMessage(chatId, '❌ Terjadi kesalahan. Silakan coba lagi.');
      return;
    }

    const notif = settings.notifications as Record<string, unknown>;
    notif.weeklySummaryTime = timeStr;
    await prisma.telegramSettings.update({
      where: { id: settings.id },
      data: { notifications: notif as object },
    });

    await this.bot.sendMessage(chatId, `✅ Waktu berhasil diset ke ${timeStr}`, {
      reply_markup: notificationSettingsKeyboard({
        budgetAlert: Boolean(notif.budgetAlert),
        goalProgress: Boolean(notif.goalProgress),
        weeklySummary: Boolean(notif.weeklySummary),
        weeklySummaryDay: Number(notif.weeklySummaryDay),
        weeklySummaryTime: String(notif.weeklySummaryTime),
        billsDue: Boolean(notif.billsDue),
      }),
    });
  }

  private async onVerifyCode(msg: Message, code: string): Promise<void> {
    const chatId = msg.chat.id;

    const verification = await prisma.verificationCode.findFirst({
      where: {
        code,
        expiresAt: { gt: new Date() },
        usedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!verification) {
      await this.bot.sendMessage(chatId, '❌ Kode tidak valid atau sudah expired. Buka aplikasi untuk generate kode baru.');
      return;
    }

    await prisma.verificationCode.update({
      where: { id: verification.id },
      data: { usedAt: new Date() },
    });

    await prisma.telegramSettings.upsert({
      where: { userId: verification.userId },
      create: {
        userId: verification.userId,
        telegramChatId: String(chatId),
        isLinked: true,
      },
      update: {
        telegramChatId: String(chatId),
        isLinked: true,
      },
    });

    await this.bot.sendMessage(chatId, '✅ Akun berhasil terhubung! Ketik /menu untuk melihat menu utama.', {
      reply_markup: backToMenuKeyboard(),
    });
  }

  getBotInstance(): TelegramBot {
    return this.bot;
  }
}
