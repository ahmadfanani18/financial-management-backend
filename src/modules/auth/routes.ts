import type { FastifyInstance } from 'fastify';
import { registerHandler, loginHandler, meHandler } from './controller.js';
import { authenticate } from '../../middleware/auth.js';

export async function authRoutes(fastify: FastifyInstance) {
  fastify.post('/register', {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'name', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          name: { type: 'string', minLength: 2 },
          password: { type: 'string', minLength: 6 },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            user: { type: 'object' },
            token: { type: 'string' },
          },
        },
      },
    },
  }, registerHandler);

  fastify.post('/login', {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            user: { type: 'object' },
            token: { type: 'string' },
          },
        },
      },
    },
  }, loginHandler);

  fastify.get('/me', {
    preHandler: [authenticate],
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            user: { type: 'object' },
          },
        },
      },
    },
  }, meHandler);
}
