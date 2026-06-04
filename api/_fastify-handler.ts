import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import serverless from 'serverless-http';

const fastify = Fastify({
  logger: false,
  ignoreTrailingSlash: true,
});

let initialized = false;

async function init() {
  if (initialized) return;

  const config = (await import('../dist/config/index.js')).config;
  const authenticate = (await import('../dist/middleware/auth.js')).authenticate;
  const authRoutes = (await import('../dist/modules/auth/routes.js')).authRoutes;
  const accountRoutes = (await import('../dist/modules/account/routes.js')).accountRoutes;
  const categoryRoutes = (await import('../dist/modules/category/routes.js')).categoryRoutes;
  const transactionRoutes = (await import('../dist/modules/transaction/routes.js')).transactionRoutes;
  const budgetRoutes = (await import('../dist/modules/budget/routes.js')).budgetRoutes;
  const goalRoutes = (await import('../dist/modules/goal/routes.js')).goalRoutes;
  const planRoutes = (await import('../dist/modules/plan/routes.js')).planRoutes;
  const aiRoutes = (await import('../dist/modules/ai/routes.js')).aiRoutes;
  const reportRoutes = (await import('../dist/modules/report/routes.js')).reportRoutes;
  const notificationRoutes = (await import('../dist/modules/notification/routes.js')).notificationRoutes;
  const userRoutes = (await import('../dist/modules/user/routes.js')).userRoutes;
  const searchRoutes = (await import('../dist/modules/search/routes.js')).searchRoutes;
  const subscriptionRoutes = (await import('../dist/modules/subscription/routes.js')).subscriptionRoutes;
  const paymentRoutes = (await import('../dist/modules/payment/index.js')).paymentRoutes;
  const { adminRoutes, adminUsersRoutes, adminSubscriptionRoutes } = await import('../dist/modules/admin/index.js');

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

  await fastify.register(jwt, { secret: config.jwtSecret });

  fastify.decorate('authenticate', authenticate);

  fastify.get('/health', async () => ({ status: 'ok' }));

  fastify.get('/api/pricing', async (request, reply) => {
    try {
      const { adminPricing } = await import('../dist/modules/admin/admin-pricing.service.js');
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

  await fastify.ready();
  initialized = true;
}

let serverlessHandler: any = null;

async function getServerlessHandler() {
  if (!serverlessHandler) {
    await init();
    serverlessHandler = serverless(fastify as any);
  }
  return serverlessHandler;
}

export { getServerlessHandler };