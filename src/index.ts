import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import { config } from './config/index.js';
import { prisma } from './config/prisma.js';
import { authenticate } from './middleware/auth.js';
import { authRoutes } from './modules/auth/routes.js';
import { accountRoutes } from './modules/account/routes.js';
import { categoryRoutes } from './modules/category/routes.js';
import { transactionRoutes } from './modules/transaction/routes.js';
import { budgetRoutes } from './modules/budget/routes.js';
import { goalRoutes } from './modules/goal/routes.js';
import { planRoutes } from './modules/plan/routes.js';

const fastify = Fastify({
  logger: true,
});

await fastify.register(cors, {
  origin: true,
  credentials: true,
});

await fastify.register(jwt, {
  secret: config.jwtSecret,
});

fastify.decorate('authenticate', authenticate);

fastify.get('/health', async () => ({ status: 'ok' }));

await fastify.register(authRoutes, { prefix: '/api/auth' });
await fastify.register(accountRoutes, { prefix: '/api/accounts' });
await fastify.register(categoryRoutes, { prefix: '/api/categories' });
await fastify.register(transactionRoutes, { prefix: '/api/transactions' });
await fastify.register(budgetRoutes, { prefix: '/api/budgets' });
await fastify.register(goalRoutes, { prefix: '/api/goals' });
await fastify.register(planRoutes, { prefix: '/api/plans' });

fastify.addHook('onClose', async () => {
  await prisma.$disconnect();
});

const start = async () => {
  try {
    await fastify.listen({ port: config.port, host: '0.0.0.0' });
    console.log(`Server running on http://localhost:${config.port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
