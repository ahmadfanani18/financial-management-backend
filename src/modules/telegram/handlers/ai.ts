import TelegramBot from 'node-telegram-bot-api';
import { prisma } from '../../../config/prisma.js';
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

export class AIHandler {
  private bot: TelegramBot;

  constructor(bot: TelegramBot) {
    this.bot = bot;
  }

  async handleAsk(chatId: number, question: string): Promise<void> {
    const settings = await prisma.telegramSettings.findUnique({
      where: { telegramChatId: String(chatId) },
    });

    if (!settings?.isLinked) {
      await this.bot.sendMessage(chatId, '🔗 Akun belum terhubung.');
      return;
    }

    if (!question || question.trim().length === 0) {
      await this.bot.sendMessage(chatId, '❓ Silakan ajukan pertanyaan. Contoh: /ask berapa pengeluaran saya bulan ini?');
      return;
    }

    await this.bot.sendMessage(chatId, '⏳ Sedang memproses pertanyaan Anda...');

    try {
      const userId = settings.userId;
      const result = await this.processQuestion(userId, question);
      await this.bot.sendMessage(chatId, result, { parse_mode: 'Markdown' });
    } catch {
      await this.bot.sendMessage(chatId, '❌ Terjadi kesalahan saat memproses pertanyaan. Silakan coba lagi nanti.');
    }
  }

  private async processQuestion(userId: string, question: string): Promise<string> {
    const lowerQuestion = question.toLowerCase();

    if (lowerQuestion.includes('pengeluaran') || lowerQuestion.includes('expense')) {
      const result = await this.getSpendingSummary(userId);
      return result;
    }

    if (lowerQuestion.includes('pendapatan') || lowerQuestion.includes('income')) {
      const result = await this.getIncomeSummary(userId);
      return result;
    }

    if (lowerQuestion.includes('saldo') || lowerQuestion.includes('balance')) {
      const result = await this.getBalanceSummary(userId);
      return result;
    }

    return `🤖 Pertanyaan: ${question}\n\nMaaf, saya belum bisa menjawab pertanyaan tersebut secara spesifik melalui Telegram. Gunakan aplikasi web untuk fitur AI lengkap.`;
  }

  private async getSpendingSummary(userId: string): Promise<string> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const transactions = await prisma.transaction.findMany({
      where: {
        userId,
        type: 'EXPENSE',
        date: { gte: startOfMonth, lte: endOfMonth },
      },
      include: { category: true },
    });

    const total = transactions.reduce((sum, tx) => sum + decryptAmount(tx.amount), 0);
    const byCategory: Record<string, number> = {};

    for (const tx of transactions) {
      const catName = tx.category?.name || 'Lainnya';
      byCategory[catName] = (byCategory[catName] || 0) + decryptAmount(tx.amount);
    }

    const topCategories = Object.entries(byCategory)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    let response = `📊 *Ringkasan Pengeluaran Bulan Ini*\n\n`;
    response += `Total: ${total.toLocaleString('id-ID')}\n\n`;
    response += `🛍️ Top Kategori:\n`;
    for (const [cat, amount] of topCategories) {
      response += `  • ${cat}: ${amount.toLocaleString('id-ID')}\n`;
    }

    return response;
  }

  private async getIncomeSummary(userId: string): Promise<string> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const transactions = await prisma.transaction.findMany({
      where: {
        userId,
        type: 'INCOME',
        date: { gte: startOfMonth, lte: endOfMonth },
      },
    });

    const total = transactions.reduce((sum, tx) => sum + decryptAmount(tx.amount), 0);
    const count = transactions.length;

    return `📥 *Ringkasan Pendapatan Bulan Ini*\n\nTotal: ${total.toLocaleString('id-ID')}\nJumlah transaksi: ${count}`;
  }

  private async getBalanceSummary(userId: string): Promise<string> {
    const accounts = await prisma.account.findMany({
      where: { userId, isArchived: false },
    });

    const total = accounts.reduce((sum, acc) => sum + decryptAmount(acc.balance), 0);

    let response = `💰 *Ringkasan Saldo*\n\n`;
    response += `Total: ${total.toLocaleString('id-ID')}\n\n`;
    response += `📋 Per Akun:\n`;

    for (const acc of accounts) {
      response += `  • ${acc.name}: ${parseFloat(acc.balance || '0').toLocaleString('id-ID')}\n`;
    }

    return response;
  }
}
