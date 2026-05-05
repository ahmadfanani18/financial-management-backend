import type { FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/auth.js';
import { getProfileHandler, updateProfileHandler } from '../modules/user/controller.js';

export async function userRoutes(fastify: FastifyInstance) {
  fastify.get('/me', { preHandler: [authenticate] }, getProfileHandler);
  fastify.put('/me', { preHandler: [authenticate] }, updateProfileHandler);
}