import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate, requireAdmin } from '../../middleware/auth.js';
import { adminSubscriptionService } from './admin-subscription.service.js';

export async function adminSubscriptionRoutes(fastify: FastifyInstance) {
  fastify.get('/subscriptions', {
    preHandler: [authenticate, requireAdmin],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const overview = await adminSubscriptionService.getOverview();
      const [active, pending, expiring] = await Promise.all([
        adminSubscriptionService.getActiveSubscriptions(),
        adminSubscriptionService.getPendingPayments(),
        adminSubscriptionService.getExpiringSubscriptions(),
      ]);
      return reply.send({ overview, active, pending, expiring });
    } catch (error) {
      return reply.status(500).send({ error: 'Failed to get subscription data' });
    }
  });

  fastify.patch('/subscriptions/:userId/extend', {
    preHandler: [authenticate, requireAdmin],
  }, async (request: FastifyRequest<{ Params: { userId: string }; Body: { days: number } }>, reply: FastifyReply) => {
    try {
      const user = await adminSubscriptionService.extendSubscription(request.params.userId, request.body.days);
      return reply.send(user);
    } catch (error) {
      return reply.status(500).send({ error: 'Failed to extend subscription' });
    }
  });

  fastify.patch('/subscriptions/:userId/tier', {
    preHandler: [authenticate, requireAdmin],
  }, async (request: FastifyRequest<{ Params: { userId: string }; Body: { tier: string } }>, reply: FastifyReply) => {
    try {
      const user = await adminSubscriptionService.changeTier(request.params.userId, request.body.tier as 'FREE' | 'TRIAL' | 'PRO');
      return reply.send(user);
    } catch (error) {
      return reply.status(500).send({ error: 'Failed to change tier' });
    }
  });

  fastify.patch('/subscriptions/:userId/freeze', {
    preHandler: [authenticate, requireAdmin],
  }, async (request: FastifyRequest<{ Params: { userId: string }; Body: { reason: string } }>, reply: FastifyReply) => {
    try {
      const user = await adminSubscriptionService.freezeAccount(request.params.userId, request.body.reason);
      return reply.send(user);
    } catch (error) {
      return reply.status(500).send({ error: 'Failed to freeze account' });
    }
  });

  fastify.patch('/subscriptions/:userId/cancel', {
    preHandler: [authenticate, requireAdmin],
  }, async (request: FastifyRequest<{ Params: { userId: string } }>, reply: FastifyReply) => {
    try {
      const user = await adminSubscriptionService.cancelSubscription(request.params.userId);
      return reply.send(user);
    } catch (error) {
      return reply.status(500).send({ error: 'Failed to cancel subscription' });
    }
  });

  fastify.post('/subscriptions/send-reminders', {
    preHandler: [authenticate, requireAdmin],
    schema: {
      body: {
        type: 'object',
        required: ['userIds'],
        properties: {
          userIds: {
            type: 'array',
            items: { type: 'string', format: 'uuid' },
            minItems: 1,
          },
        },
      },
    },
  }, async (request: FastifyRequest<{ Body: { userIds: string[] } }>, reply: FastifyReply) => {
    try {
      const { userIds } = request.body;
      
      if (!Array.isArray(userIds) || userIds.length === 0) {
        return reply.status(400).send({ error: 'userIds harus array dengan minimal 1 item' });
      }

      const result = await adminSubscriptionService.sendRenewalReminders(userIds);
      return reply.send(result);
    } catch (error) {
      console.error('Send reminders error:', error);
      return reply.status(500).send({ error: 'Gagal mengirim reminder' });
    }
  });
}
