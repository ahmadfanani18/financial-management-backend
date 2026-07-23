import TelegramBot from 'node-telegram-bot-api';
import { prisma } from '../../../config/prisma.js';
import { formatAccountBalance, formatTransactionList } from '../lib/formatter.js';
import { accountSelectionKeyboard, periodSelectionKeyboard, backToMenuKeyboard } from '../lib/keyboard.js';
import { parseDate, formatDateRange } from '../lib/date-parser.js';
import { startOfDay } from 'date-fns';
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

interface MutasiSession {
  userId: string;
  step: 'account' | 'period' | 'custom';
  accountId?: string;
  startDate?: Date;
  endDate?: Date;
}

const mutasiSessions = new Map<number, MutasiSession>();

export class AccountHandler {
  private bot: TelegramBot;

  constructor(bot: TelegramBot) {
    this.bot = bot;
  }

  async handleSaldo(chatId: number): Promise<void> {
    const settings = await prisma.telegramSettings.findUnique({
      where: { telegramChatId: String(chatId) },
      include: { user: { include: { accounts: true } } },
    });

    if (!settings?.isLinked) {
      await this.bot.sendMessage(chatId, '🔗 Akun belum terhubung. Hubungkan melalui aplikasi web.');
      return;
    }

    const accounts = settings.user.accounts.filter((a: { isArchived: boolean }) => !a.isArchived);
    await this.bot.sendMessage(chatId, formatAccountBalance(accounts), { parse_mode: 'Markdown' });
  }

  async handleMutasi(chatId: number, args?: string): Promise<void> {
    const settings = await prisma.telegramSettings.findUnique({
      where: { telegramChatId: String(chatId) },
      include: { user: { include: { accounts: true } } },
    });

    if (!settings?.isLinked) {
      await this.bot.sendMessage(chatId, '🔗 Akun belum terhubung.');
      return;
    }

    const accounts = settings.user.accounts.filter((a: { isArchived: boolean }) => !a.isArchived);
    if (accounts.length === 0) {
      await this.bot.sendMessage(chatId, 'Tidak ada akun ditemukan.');
      return;
    }

    if (args) {
      const dateRange = parseDate(args);
      if (dateRange && accounts.length > 0) {
        await this.sendMutasi(chatId, accounts[0].id, settings.userId, dateRange.start, dateRange.end);
        return;
      }
    }

    await this.bot.sendMessage(chatId, 'Pilih akun untuk melihat mutasi:', {
      reply_markup: accountSelectionKeyboard(accounts.map((a: { id: string; name: string }) => ({ id: a.id, name: a.name }))),
    });
  }

  async handleAccountSelection(chatId: number, accountId: string, messageId?: number): Promise<void> {
    const settings = await prisma.telegramSettings.findUnique({
      where: { telegramChatId: String(chatId) },
      include: { user: { include: { accounts: true } } },
    });

    if (!settings?.isLinked) {
      await this.bot.sendMessage(chatId, '🔗 Akun belum terhubung.');
      return;
    }

    const account = settings.user.accounts.find((a: { id: string }) => a.id === accountId);
    if (!account) {
      await this.bot.sendMessage(chatId, 'Akun tidak ditemukan.');
      return;
    }

    mutasiSessions.set(chatId, {
      userId: settings.userId,
      step: 'period',
      accountId,
    });

    await this.bot.sendMessage(chatId, `📊 Mutasi untuk *${account.name}*\n\nPilih periode:`, {
      parse_mode: 'Markdown',
      reply_markup: periodSelectionKeyboard(),
    });
  }

  async handlePeriodSelection(chatId: number, period: string, messageId?: number): Promise<void> {
    const session = mutasiSessions.get(chatId);
    if (!session || session.step !== 'period' || !session.accountId) {
      await this.bot.sendMessage(chatId, 'Sesi berakhir. Silakan mulai lagi dengan /mutasi');
      return;
    }

    let dateRange;
    if (period === 'today') {
      dateRange = parseDate('hari ini');
    } else if (period === 'week') {
      dateRange = parseDate('minggu ini');
    } else if (period === 'month') {
      dateRange = parseDate('bulan ini');
    } else if (period === 'last_month') {
      dateRange = parseDate('bulan lalu');
    } else if (period === 'custom') {
      session.step = 'custom';
      mutasiSessions.set(chatId, session);
      await this.bot.sendMessage(chatId, '📅 Silakan masukkan range tanggal dengan format:\n「tanggal - tanggal」\nContoh: 1 juli 2026 - 31 juli 2026');
      return;
    } else {
      dateRange = null;
    }

    if (!dateRange) {
      await this.bot.sendMessage(chatId, 'Periode tidak valid.');
      return;
    }

    mutasiSessions.delete(chatId);
    await this.sendMutasi(chatId, session.accountId, session.userId, dateRange.start, dateRange.end);
  }

  async sendMutasi(chatId: number, accountId: string, userId: string, startDate: Date, endDate: Date): Promise<void> {
    const account = await prisma.account.findFirst({
      where: { id: accountId, userId },
    });

    if (!account) {
      await this.bot.sendMessage(chatId, 'Akun tidak ditemukan.');
      return;
    }

    const transactions = await prisma.transaction.findMany({
      where: {
        userId,
        date: { gte: startDate, lte: endDate },
        OR: [
          { accountId: accountId },
          { fromAccountId: accountId },
          { toAccountId: accountId },
        ],
      },
      include: { category: true },
      orderBy: { date: 'desc' },
    });

    const displayTransactions = transactions.map(tx => ({
      id: tx.id,
      type: tx.type,
      amount: tx.amount,
      description: tx.description,
      date: tx.date,
      categoryName: tx.category?.name,
      accountName: account.name,
    }));

    const text = `📊 Mutasi ${account.name}\n${formatDateRange({ start: startDate, end: endDate })}\n\n${formatTransactionList(displayTransactions)}`;

    await this.bot.sendMessage(chatId, text, {
      parse_mode: 'Markdown',
      reply_markup: backToMenuKeyboard(),
    });
  }

  async getBalanceBefore(accountId: string, userId: string, date: Date): Promise<number> {
    const expenseTxs = await prisma.transaction.findMany({
      where: {
        userId,
        accountId,
        date: { lt: startOfDay(date) },
        type: 'EXPENSE',
      },
      select: { amount: true },
    });

    const incomeTxs = await prisma.transaction.findMany({
      where: {
        userId,
        toAccountId: accountId,
        date: { lt: startOfDay(date) },
        type: 'INCOME',
      },
      select: { amount: true },
    });

    const expenses = expenseTxs.reduce((sum, tx) => sum + decryptAmount(tx.amount), 0);
    const income = incomeTxs.reduce((sum, tx) => sum + decryptAmount(tx.amount), 0);

    return income - expenses;
  }
}
