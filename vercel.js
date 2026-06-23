import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import { config } from './dist/config/index.js';
import { prisma } from './dist/config/prisma.js';
import { authenticate } from './dist/middleware/auth.js';
import { authRoutes } from './dist/modules/auth/routes.js';
import { accountRoutes } from './dist/modules/account/routes.js';
import { categoryRoutes } from './dist/modules/category/routes.js';
import { transactionRoutes } from './dist/modules/transaction/routes.js';
import { budgetRoutes } from './dist/modules/budget/routes.js';
import { goalRoutes } from './dist/modules/goal/routes.js';
import { planRoutes } from './dist/modules/plan/routes.js';
import { aiRoutes } from './dist/modules/ai/routes.js';
import { reportRoutes } from './dist/modules/report/routes.js';
import { notificationRoutes } from './dist/modules/notification/routes.js';
import { userRoutes } from './dist/modules/user/routes.js';
import { searchRoutes } from './dist/modules/search/routes.js';
import { subscriptionRoutes } from './dist/modules/subscription/routes.js';
import { paymentRoutes } from './dist/modules/payment/index.js';
import { adminRoutes, adminUsersRoutes, adminSubscriptionRoutes } from './dist/modules/admin/index.js';

const fastify = Fastify({
  logger: false,
});

await fastify.register(cors, {
  origin: [
    'http://localhost:3000',
    'http://localhost:3001',
    'https://financial-management-frontend.vercel.app',
    'https://financial-management-frontend-*.vercel.app',
    'https://financial-management-backend-self.vercel.app',
    'https://financial-management-backend-*.vercel.app'
  ],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization'],
  methods: ['GET', 'PUT', 'POST', 'DELETE', 'PATCH', 'OPTIONS'],
});

await fastify.register(jwt, {
  secret: config.jwtSecret,
});

fastify.decorate('authenticate', authenticate);

fastify.get('/health', async () => ({ status: 'ok' }));

fastify.get('/api/pricing', async (request, reply) => {
  try {
    const { adminPricing } = await import('./dist/modules/admin/admin-pricing.service.js');
    const pricings = await adminPricing.getPricings();
    return reply.send(pricings);
  } catch (error) {
    return reply.status(500).send({ error: 'Failed to get pricings' });
  }
});

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
await fastify.register(searchRoutes, { prefix: '/api/search' });
await fastify.register(subscriptionRoutes, { prefix: '/api/subscription' });
await fastify.register(paymentRoutes, { prefix: '/api/payment' });
await fastify.register(adminRoutes, { prefix: '/api/admin' });
await fastify.register(adminUsersRoutes, { prefix: '/api/admin' });
await fastify.register(adminSubscriptionRoutes, { prefix: '/api/admin' });

fastify.addHook('onClose', async () => {
  await prisma.$disconnect();
});

export default async function handler(req, res) {
  const fastifyReq = {
    method: req.method || 'GET',
    url: req.url || '/',
    headers: req.headers,
    body: req.body,
    query: req.query,
  };

  try {
    const result = await fastify.handle(fastifyReq);
    res.status(result.statusCode || 200);
    if (result.body) {
      res.send(result.body);
    } else {
      res.send(result);
    }
  } catch (error) {
    console.error('Fastify error:', error);
    res.status(500).send({ error: error.message || 'Internal server error' });
  }
}
