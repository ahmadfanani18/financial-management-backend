import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import crypto from 'crypto';
import { prisma } from '../../config/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { getBot } from './index.js';

const linkCodeSchema = z.object({
  code: z.string().min(6).max(6),
});

export async function telegramRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post('/webhook', async (request, reply) => {
    const bot = getBot();
    if (!bot) {
      return reply.status(500).send({ error: 'Bot not initialized' });
    }

    const secretToken = request.headers['x-telegram-bot-api-secret-token'] as string;
    const expectedToken = process.env.TELEGRAM_SECRET_TOKEN;

    if (expectedToken && secretToken && secretToken !== expectedToken) {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    try {
      await bot.processUpdate(request.body as never);
      // Wait a bit for handlers to complete in serverless
      await new Promise(resolve => setTimeout(resolve, 500));
      return reply.send({ ok: true });
    } catch (error) {
      console.error('Webhook processing error:', error);
      return reply.status(500).send({ error: 'Failed to process update' });
    }
  });

  fastify.get('/webhook', async (request, reply) => {
    return reply.send({ ok: true, message: 'Telegram webhook endpoint' });
  });

  fastify.post('/link-code', { preHandler: authenticate }, async (request, reply) => {
    const userId = request.user.id;

    const existing = await prisma.verificationCode.findMany({
      where: { userId, usedAt: null, expiresAt: { gt: new Date() } },
    });

    if (existing.length > 0) {
      await prisma.verificationCode.updateMany({
        where: { id: { in: existing.map(v => v.id) } },
        data: { usedAt: new Date() },
      });
    }

    const code = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.verificationCode.create({
      data: { code, userId, expiresAt },
    });

    await prisma.telegramSettings.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });

    return reply.send({ code, expiresAt: expiresAt.toISOString() });
  });

  fastify.get('/settings', { preHandler: authenticate }, async (request, reply) => {
    const userId = request.user.id;

    const settings = await prisma.telegramSettings.findUnique({
      where: { userId },
    });

    if (!settings) {
      return reply.send({
        isLinked: false,
        notifications: {
          budgetAlert: true,
          goalProgress: true,
          weeklySummary: true,
          weeklySummaryDay: 0,
          weeklySummaryTime: '09:00',
          billsDue: true,
        },
      });
    }

    return reply.send({
      isLinked: settings.isLinked,
      notifications: settings.notifications,
    });
  });

  fastify.patch('/settings', { preHandler: authenticate }, async (request, reply) => {
    const userId = request.user.id;
    const body = request.body as Record<string, unknown>;

    const settings = await prisma.telegramSettings.findUnique({
      where: { userId },
    });

    if (!settings) {
      return reply.status(404).send({ error: 'Settings not found' });
    }

    if (body.notifications) {
      await prisma.telegramSettings.update({
        where: { userId },
        data: { notifications: body.notifications as object },
      });
    }

    return reply.send({ ok: true });
  });
}
