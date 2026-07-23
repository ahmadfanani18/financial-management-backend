import TelegramBot from 'node-telegram-bot-api';
import { prisma } from '../../../config/prisma.js';
import { confirmUnlinkKeyboard, backToMenuKeyboard } from '../lib/keyboard.js';

export class AuthHandler {
  private bot: TelegramBot;

  constructor(bot: TelegramBot) {
    this.bot = bot;
  }

  async handleStart(chatId: number): Promise<void> {
    const settings = await prisma.telegramSettings.findUnique({
      where: { telegramChatId: String(chatId) },
    });

    if (settings?.isLinked) {
      await this.bot.sendMessage(
        chatId,
        '👋 Selamat datang kembali! Akun Anda sudah terhubung dengan Telegram.\n\nGunakan /menu untuk melihat menu utama.',
        { parse_mode: 'Markdown' }
      );
      return;
    }

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
/unlink - Putuskan koneksi Telegram

🔗 Untuk menghubungkan akun, silakan buka aplikasi web dan pergi ke Pengaturan > Telegram.`;

    await this.bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
  }

  async handleUnlink(chatId: number, messageId?: number): Promise<void> {
    const settings = await prisma.telegramSettings.findUnique({
      where: { telegramChatId: String(chatId) },
    });

    if (!settings?.isLinked) {
      await this.bot.sendMessage(chatId, '🔗 Akun Telegram belum terhubung.');
      return;
    }

    const text = '⚠️ Apakah Anda yakin ingin memutuskan koneksi Telegram?';

    if (messageId) {
      await this.bot.editMessageText(text, {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: confirmUnlinkKeyboard(),
      });
    } else {
      await this.bot.sendMessage(chatId, text, {
        reply_markup: confirmUnlinkKeyboard(),
      });
    }
  }

  async confirmUnlink(chatId: number, messageId?: number): Promise<void> {
    const settings = await prisma.telegramSettings.findUnique({
      where: { telegramChatId: String(chatId) },
    });

    if (!settings?.isLinked) {
      await this.bot.sendMessage(chatId, '🔗 Akun Telegram belum terhubung.');
      return;
    }

    await prisma.telegramSettings.update({
      where: { telegramChatId: String(chatId) },
      data: { isLinked: false, telegramChatId: null },
    });

    const text = '✅ Koneksi Telegram telah diputuskan. Anda dapat menghubungkan kembali kapan saja melalui aplikasi web.';

    if (messageId) {
      await this.bot.editMessageText(text, {
        chat_id: chatId,
        message_id: messageId,
      });
    } else {
      await this.bot.sendMessage(chatId, text);
    }
  }

  async handleLinkCode(chatId: number, code: string): Promise<void> {
    if (!code || code.trim().length === 0) {
      await this.bot.sendMessage(chatId, '❌ Kode tidak valid. Silakan masukkan kode yang valid.');
      return;
    }

    const verificationCode = await prisma.verificationCode.findFirst({
      where: {
        code: code.trim(),
        expiresAt: { gt: new Date() },
        usedAt: null,
      },
      include: { user: true },
    });

    if (!verificationCode) {
      await this.bot.sendMessage(chatId, '❌ Kode tidak valid atau sudah kedaluwarsa. Silakan coba lagi.');
      return;
    }

    const existingSettings = await prisma.telegramSettings.findUnique({
      where: { userId: verificationCode.userId },
    });

    if (existingSettings?.isLinked && existingSettings.telegramChatId !== String(chatId)) {
      await this.bot.sendMessage(chatId, '❌ Akun sudah terhubung dengan Telegram lain. Putuskan koneksi terlebih dahulu.');
      return;
    }

    await prisma.$transaction(async (tx) => {
      await tx.verificationCode.update({
        where: { id: verificationCode.id },
        data: { usedAt: new Date() },
      });

      await tx.telegramSettings.upsert({
        where: { userId: verificationCode.userId },
        create: {
          userId: verificationCode.userId,
          telegramChatId: String(chatId),
          isLinked: true,
        },
        update: {
          telegramChatId: String(chatId),
          isLinked: true,
        },
      });
    });

    await this.bot.sendMessage(
      chatId,
      `✅ Berhasil! Akun ${verificationCode.user.email} telah terhubung dengan Telegram.\n\nSelamat menggunakan Financial Management Bot!`,
      { parse_mode: 'Markdown', reply_markup: backToMenuKeyboard() }
    );
  }
}
