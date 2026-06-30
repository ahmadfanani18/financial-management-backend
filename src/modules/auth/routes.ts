import type { FastifyInstance } from 'fastify';
import { registerHandler, loginHandler, meHandler, changePasswordHandler, forgotPasswordHandler, resetPasswordHandler, verifyEmailHandler, resendVerificationHandler } from './controller.js';
import { authenticate } from '../../middleware/auth.js';
import { createRateLimitMiddleware } from '../../middleware/rate-limit.js';

export async function authRoutes(fastify: FastifyInstance) {
  const rateLimit = createRateLimitMiddleware();

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
            verifyUrl: { type: 'string' },
          },
        },
      },
    },
  }, registerHandler);

  fastify.post('/login', {
    preHandler: [rateLimit],
  }, loginHandler);

  fastify.get('/me', { preHandler: [authenticate] }, meHandler);

  fastify.put('/change-password', {
    preHandler: [authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['currentPassword', 'newPassword'],
        properties: {
          currentPassword: { type: 'string', minLength: 6 },
          newPassword: { type: 'string', minLength: 6 },
        },
      },
    },
  }, changePasswordHandler);

  fastify.post('/forgot-password', {
    schema: {
      body: {
        type: 'object',
        required: ['email'],
        properties: {
          email: { type: 'string', format: 'email' },
        },
      },
    },
  }, forgotPasswordHandler);

  fastify.post('/reset-password', {
    schema: {
      body: {
        type: 'object',
        required: ['token', 'password'],
        properties: {
          token: { type: 'string', minLength: 1 },
          password: { type: 'string', minLength: 8 },
        },
      },
    },
  }, resetPasswordHandler);

  fastify.post('/verify-email', {
    schema: {
      body: {
        type: 'object',
        required: ['token'],
        properties: {
          token: { type: 'string', minLength: 1 },
        },
      },
    },
  }, verifyEmailHandler);

  fastify.post('/resend-verification', {
    schema: {
      body: {
        type: 'object',
        required: ['email'],
        properties: {
          email: { type: 'string', format: 'email' },
        },
      },
    },
  }, resendVerificationHandler);
}
