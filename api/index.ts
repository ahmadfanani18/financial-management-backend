import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createServer } from 'http';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import { config } from '../src/config/index.js';
import { prisma } from '../src/config/prisma.js';
import { authenticate } from '../src/middleware/auth.js';
import { authRoutes } from '../src/modules/auth/routes.js';
import { accountRoutes } from '../src/modules/account/routes.js';
import { categoryRoutes } from '../src/modules/category/routes.js';
import { transactionRoutes } from '../src/modules/transaction/routes.js';
import { budgetRoutes } from '../src/modules/budget/routes.js';
import { goalRoutes } from '../src/modules/goal/routes.js';
import { planRoutes } from '../src/modules/plan/routes.js';
import { aiRoutes } from '../src/modules/ai/routes.js';
import { reportRoutes } from '../src/modules/report/routes.js';
import { notificationRoutes } from '../src/modules/notification/routes.js';
import { userRoutes } from '../src/modules/user/routes.js';

let fastify: Fastify.FastifyInstance | null = null;

const getFastify = async () => {
  if (fastify) return fastify;

  fastify = Fastify({ logger: false });

  await fastify.register(cors, {
    origin: [
      'http://localhost:3000',
      'http://localhost:3001',
      'https://financial-management-frontend.vercel.app',
      'https://financial-management-frontend-*.vercel.app'
    ],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
    methods: ['GET', 'PUT', 'POST', 'DELETE', 'PATCH', 'OPTIONS'],
  });

  await fastify.register(jwt, {
    secret: config.jwtSecret,
  });

  fastify.decorate('authenticate', authenticate);

  fastify.get('/api/health', async () => ({ status: 'ok' }));

  await fastify.register(authRoutes, { prefix: '/api/auth' });
  await fastify.register(accountRoutes, { prefix: '/api/accounts' });
  await fastify.register(categoryRoutes, { prefix: '/api/categories' });
  await fastify.register(transactionRoutes, { prefix: '/api/transactions' });
  await fastify.register(budgetRoutes, { prefix: '/api/budgets' });
  await fastify.register(goalRoutes, { prefix: '/api/goals' });
  await fastify.register(planRoutes, { prefix: '/api/plans' });
  await fastify.register(aiRoutes, { prefix: '/api/ai' });
  await fastify.register(reportRoutes, { prefix: '/api/reports' });
  await fastify.register(notificationRoutes, { prefix: '/api/notifications' });
  await fastify.register(userRoutes, { prefix: '/api/user' });

  return fastify;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const fastify = await getFastify();
  
  const { method, url, headers } = req;
  
  return new Promise((resolve) => {
    const requestHeaders: Record<string, string> = {};
    for (const [key, value] of Object.entries(headers)) {
      if (value) requestHeaders[key] = Array.isArray(value) ? value[0] : value;
    }

    const simulatedReq = {
      method: method || 'GET',
      url: url || '/',
      headers: requestHeaders,
      body: req.body,
    };

    const chunks: Buffer[] = [];
    const simulatedRes = {
      statusCode: 200,
      headers: {} as Record<string, string>,
      setHeader: (key: string, value: string) => { simulatedRes.headers[key] = value; },
      getHeader: (key: string) => simulatedRes.headers[key],
      removeHeader: () => {},
      end: (data?: string) => {
        res.status(simulatedRes.statusCode);
        for (const [key, value] of Object.entries(simulatedRes.headers)) {
          res.setHeader(key, value);
        }
        res.send(data || '');
        resolve();
      },
      on: () => simulatedRes,
      emit: () => simulatedRes,
      removeListener: () => {},
    };

    fastify.server.emit('request', simulatedReq as Parameters<typeof fastify.server.emit>[1], simulatedRes as Parameters<typeof fastify.server.emit>[2]);
  });
}