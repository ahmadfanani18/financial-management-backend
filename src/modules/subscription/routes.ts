import type { FastifyInstance } from 'fastify';
import { activateTrialHandler, getFeaturesHandler, getPublicPricingHandler } from './controller.js';
import { authenticate } from '../../middleware/auth.js';
import { adminPricing } from '../admin/admin-pricing.service.js';

export async function subscriptionRoutes(fastify: FastifyInstance) {
  fastify.post('/activate-trial', {
    preHandler: authenticate,
  }, activateTrialHandler);

  fastify.get('/features', {
    preHandler: authenticate,
  }, getFeaturesHandler);

  fastify.get('/pricing', async (request, reply) => {
    try {
      const pricings = await adminPricing.getPricings();
      return reply.send(pricings);
    } catch (error) {
      return reply.status(500).send({ error: 'Failed to get pricings' });
    }
  });
}