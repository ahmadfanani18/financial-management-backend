import type { FastifyInstance } from 'fastify';
import { activateTrialHandler, getFeaturesHandler } from './controller.js';
import { authenticate } from '../../middleware/auth.js';

export async function subscriptionRoutes(fastify: FastifyInstance) {
  fastify.post('/activate-trial', {
    preHandler: authenticate,
  }, activateTrialHandler);

  fastify.get('/features', {
    preHandler: authenticate,
  }, getFeaturesHandler);
}