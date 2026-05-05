import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import { config } from '../src/config/index.js';
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

const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'https://financial-management-frontend.vercel.app'
];

const createApp = async () => {
  const fastify = Fastify({ logger: false });

  await fastify.register(cors, {
    origin: ALLOWED_ORIGINS,
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

let app: Awaited<ReturnType<typeof createApp>> | null = null;

export default async function handler(req: unknown, res: unknown) {
  const vercelReq = req as { method: string; url: string; headers: Record<string, string | string[] | undefined>; body: unknown };
  const vercelRes = res as { status: (code: number) => typeof vercelRes; setHeader: (key: string, value: string) => void; send: (data: string) => void };

  const origin = vercelReq.headers.origin;
  if (ALLOWED_ORIGINS.includes(origin as string)) {
    vercelRes.setHeader('Access-Control-Allow-Origin', origin as string);
    vercelRes.setHeader('Access-Control-Allow-Credentials', 'true');
    vercelRes.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    vercelRes.setHeader('Access-Control-Allow-Methods', 'GET, PUT, POST, DELETE, PATCH, OPTIONS');
  }

  if (vercelReq.method === 'OPTIONS') {
    vercelRes.status(204).send('');
    return;
  }

  if (!app) {
    app = await createApp();
  }

  const reply = await app.handle({
    method: vercelReq.method || 'GET',
    url: vercelReq.url || '/',
    headers: vercelReq.headers,
    body: vercelReq.body,
  });

  vercelRes.status(reply.statusCode || 200);
  
  if (reply.headers) {
    for (const [key, value] of Object.entries(reply.headers)) {
      vercelRes.setHeader(key, value as string);
    }
  }
  
  vercelRes.send(reply.body as string || '');
}