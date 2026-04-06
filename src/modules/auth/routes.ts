import type { FastifyInstance } from 'fastify';
import { registerHandler, loginHandler, meHandler } from './controller.js';
import { authenticate } from '../../middleware/auth.js';

export async function authRoutes(fastify: FastifyInstance) {
  fastify.post('/register', registerHandler);
  fastify.post('/login', loginHandler);
  
  fastify.get('/me', {
    preHandler: [authenticate],
  }, meHandler);
}
