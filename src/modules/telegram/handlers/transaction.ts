import TelegramBot from 'node-telegram-bot-api';
import { prisma } from '../../../config/prisma.js';
import { formatTransactionList } from '../lib/formatter.js';
import { periodSelectionKeyboard, backToMenuKeyboard } from '../lib/keyboard.js';
import { parseDate, formatDateRange } from '../lib/date-parser.js';

export class TransactionHandler {
  private bot: TelegramBot;

  constructor(bot: TelegramBot) {
    this.bot = bot;
  }

  async handleTransaksi(chatId: number, args?: string): Promise<void> {
    const settings = await prisma.telegramSettings.findUnique({
      where: { telegramChatId: String(chatId) },
      include: {
        user: {
          include: {
            accounts: { where: { isArchived: false } },
          },
        },
      },
    });

    if (!settings?.isLinked) {
      await this.bot.sendMessage(chatId, '🔗 Akun belum terhubung.');
      return;
    }

    if (args) {
      const dateRange = parseDate(args);
      if (dateRange) {
        await this.sendTransactions(chatId, settings.userId, dateRange.start, dateRange.end);
        return;
      }
    }

    await this.bot.sendMessage(chatId, 'Pilih periode untuk melihat transaksi:', {
      reply_markup: periodSelectionKeyboard(),
    });
  }

  async sendTransactions(chatId: number, userId: string, startDate: Date, endDate: Date): Promise<void> {
    const transactions = await prisma.transaction.findMany({
      where: {
        userId,
        date: { gte: startDate, lte: endDate },
      },
      include: { category: true, account: true },
      orderBy: { date: 'desc' },
    });

    const displayTransactions = transactions.map(tx => ({
      id: tx.id,
      type: tx.type,
      amount: tx.amount,
      description: tx.description,
      date: tx.date,
      categoryName: tx.category?.name,
      accountName: tx.account?.name,
    }));

    const text = `💳 Transaksi\n${formatDateRange({ start: startDate, end: endDate })}\n\n${formatTransactionList(displayTransactions)}`;

    await this.bot.sendMessage(chatId, text, {
      parse_mode: 'Markdown',
      reply_markup: backToMenuKeyboard(),
    });
  }
}
