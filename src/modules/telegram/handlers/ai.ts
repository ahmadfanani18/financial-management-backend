import TelegramBot from 'node-telegram-bot-api';
import { prisma } from '../../../config/prisma.js';
import { decrypt } from '../../../utils/encryption.js';
import { buildFinancialContext, buildSystemPrompt } from '../../ai/context-builder.js';
import { createRouter, classifyQuery } from '../../ai/router.js';
import type { AIMessage } from '../../ai/providers/index.js';
import { getUserWithApiKeys } from '../../user/api-keys-service.js';

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
      const result = await this.processWithAI(userId, question);
      await this.bot.sendMessage(chatId, result);
    } catch (error) {
      console.error('AI processing error:', error);
      await this.bot.sendMessage(chatId, '❌ Terjadi kesalahan saat memproses pertanyaan. Silakan coba lagi nanti.');
    }
  }

  private async processWithAI(userId: string, question: string): Promise<string> {
    const [user, context] = await Promise.all([
      getUserWithApiKeys(userId),
      buildFinancialContext(userId, { months: 6 }),
    ]);

    const systemPrompt = buildSystemPrompt(context);
    const complexity = classifyQuery(question);

    const fullQuestion = `${systemPrompt}\n\n---\n\nPertanyaan pengguna: ${question}`;

    const messages: AIMessage[] = [
      { role: 'user', content: fullQuestion },
    ];

    const apiKeys = {
      claude: user?.claudeApiKey,
      openai: user?.openaiApiKey,
      gemini: user?.geminiApiKey,
    };

    const router = createRouter(apiKeys);

    try {
      const response = await router.route(messages, complexity);

      let answer = this.stripMarkdown(response.content);

      if (answer.length > 4000) {
        answer = answer.substring(0, 4000) + '...\n\n(response truncated)';
      }

      return answer;
    } catch (error) {
      console.error('AI route error:', error);

      const quickAnswer = this.getQuickAnswer(question, context);
      if (quickAnswer) {
        return quickAnswer;
      }

      return `🤖 Maaf, saya sedang tidak bisa memproses pertanyaan Anda.\n\nCoba pertanyaan lain seperti:\n• /ask berapa pengeluaran saya bulan ini?\n• /ask apa goal saya saat ini?\n• /ask bagaimana kondisi keuangan saya?`;
    }
  }

  private getQuickAnswer(question: string, context: {
    totalBalance: number;
    summary: { totalExpenses: number; totalSavings: number; totalIncome: number };
    topExpenses: Array<{ category: string; amount: number }>;
    goalsProgress: Array<{ name: string; current: number; target: number; percent: number }>;
    budgetProgress: Array<{ name: string; spent: number; budgeted: number; percentUsed: number }>;
  }): string | null {
    const lower = question.toLowerCase();

    if (lower.includes('saldo') && (lower.includes('total') || lower.includes('semua'))) {
      return `💰 *Total Saldo:* Rp ${context.totalBalance.toLocaleString('id-ID')}`;
    }

    if (lower.includes('pengeluaran') && lower.includes('bulan ini')) {
      const expenses = context.summary.totalExpenses;
      return `📊 *Pengeluaran 6 Bulan Terakhir:*\nTotal: Rp ${expenses.toLocaleString('id-ID')}\n\nTop Pengeluaran:\n${context.topExpenses.slice(0, 3).map(e => `• ${e.category}: Rp ${e.amount.toLocaleString('id-ID')}`).join('\n')}`;
    }

    if (lower.includes('goal') || lower.includes('target')) {
      if (context.goalsProgress.length === 0) {
        return '🎯 *Goals:* Tidak ada goal aktif. Buat goal di aplikasi web!';
      }
      return `🎯 *Goals Progress:*\n${context.goalsProgress.map(g => `• ${g.name}: ${g.percent}% (Rp ${g.current.toLocaleString('id-ID')} / Rp ${g.target.toLocaleString('id-ID')})`).join('\n')}`;
    }

    if (lower.includes('budget') || lower.includes('anggaran')) {
      if (context.budgetProgress.length === 0) {
        return '📋 *Budget:* Tidak ada budget aktif.';
      }
      return `📋 *Budget Progress:*\n${context.budgetProgress.map(b => `• ${b.name}: ${b.percentUsed}% (Rp ${b.spent.toLocaleString('id-ID')} / Rp ${b.budgeted.toLocaleString('id-ID')})`).join('\n')}`;
    }

    if (lower.includes('tabungan') || lower.includes('savings')) {
      const savingsRate = context.summary.totalIncome > 0
        ? Math.round((context.summary.totalSavings / context.summary.totalIncome) * 100)
        : 0;
      return `💎 *Tabungan:*\nTotal: Rp ${context.summary.totalSavings.toLocaleString('id-ID')}\nRasio tabungan: ${savingsRate}%`;
    }

    return null;
  }

  private stripMarkdown(text: string): string {
    return text
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/\*(.+?)\*/g, '$1')
      .replace(/_(.+?)_/g, '$1')
      .replace(/`(.+?)`/g, '$1')
      .replace(/\[(.+?)\]\(.+?\)/g, '$1')
      .replace(/^#+\s*/gm, '')
      .replace(/^>\s*/gm, '')
      .replace(/^[-*+]\s+/gm, '• ')
      .replace(/^\d+\.\s+/gm, '');
  }
}
