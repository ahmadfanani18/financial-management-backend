import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyMultipart from '@fastify/multipart';
import jwt from '@fastify/jwt';
import { config } from './config/index.js';
import { prisma } from './config/prisma.js';
import { authenticate } from './middleware/auth.js';
import { authRoutes } from './modules/auth/routes.js';
import { accountRoutes } from './modules/account/routes.js';
import { categoryRoutes } from './modules/category/routes.js';
import { transactionRoutes } from './modules/transaction/routes.js';
import { budgetRoutes } from './modules/budget/routes.js';
import { billRoutes } from './modules/bill/routes.js';
import { goalRoutes } from './modules/goal/routes.js';
import { planRoutes } from './modules/plan/routes.js';
import { aiRoutes } from './modules/ai/routes.js';
import { reportRoutes } from './modules/report/routes.js';
import { notificationRoutes } from './modules/notification/routes.js';
import { userRoutes } from './modules/user/routes.js';
import { searchRoutes } from './modules/search/routes.js';
import { subscriptionRoutes } from './modules/subscription/routes.js';
import { marketPriceRoutes } from './modules/market-price/routes.js';
import { investmentRoutes } from './modules/investment/routes.js';
import { paymentRoutes } from './modules/payment/index.js';
import { adminRoutes, adminUsersRoutes, adminSubscriptionRoutes } from './modules/admin/index.js';
import { adminReportRoutes } from './modules/admin-report/routes.js';
import { feedbackRoutes } from './modules/feedback/routes.js';
import { startMarketSyncJob } from './jobs/market-sync.js';
import { startBillProcessorJob } from './jobs/bill-processor.js';
async function buildApp() {
    const fastify = Fastify({
        logger: true,
    });
    await fastify.register(cors, {
        origin: config.allowedOrigins,
        credentials: true,
        allowedHeaders: ['Content-Type', 'Authorization'],
        methods: ['GET', 'PUT', 'POST', 'DELETE', 'PATCH', 'OPTIONS'],
    });
    await fastify.register(fastifyMultipart, {
        limits: {
            fileSize: 5 * 1024 * 1024,
        },
    });
    if (!process.env.VERCEL) {
        const swagger = (await import('@fastify/swagger')).default;
        const swaggerUi = (await import('@fastify/swagger-ui')).default;
        await fastify.register(swagger, {
            openapi: {
                info: {
                    title: 'Financial Management API',
                    description: 'API for managing personal finances',
                    version: '1.0.0',
                },
                components: {
                    securitySchemes: {
                        bearerAuth: {
                            type: 'http',
                            scheme: 'bearer',
                            bearerFormat: 'JWT',
                        },
                    },
                },
            },
        });
        await fastify.register(swaggerUi, {
            routePrefix: '/docs',
        });
    }
    await fastify.register(jwt, {
        secret: config.jwtSecret,
    });
    fastify.decorate('authenticate', authenticate);
    fastify.get('/health', async () => ({ status: 'ok' }));
    fastify.get('/api/pricing', async (request, reply) => {
        const { adminPricing } = await import('./modules/admin/admin-pricing.service.js');
        try {
            const pricings = await adminPricing.getPricings();
            return reply.send(pricings);
        }
        catch (error) {
            return reply.status(500).send({ error: 'Failed to get pricings' });
        }
    });
    await fastify.register(authRoutes, { prefix: '/api/auth' });
    await fastify.register(accountRoutes, { prefix: '/api/accounts' });
    await fastify.register(categoryRoutes, { prefix: '/api/categories' });
    await fastify.register(transactionRoutes, { prefix: '/api/transactions' });
    await fastify.register(budgetRoutes, { prefix: '/api/budgets' });
    await fastify.register(billRoutes, { prefix: '/api/bills' });
    await fastify.register(goalRoutes, { prefix: '/api/goals' });
    await fastify.register(planRoutes, { prefix: '/api/plans' });
    await fastify.register(aiRoutes, { prefix: '/api/ai' });
    await fastify.register(reportRoutes, { prefix: '/api/reports' });
    await fastify.register(notificationRoutes, { prefix: '/api/notifications' });
    await fastify.register(userRoutes, { prefix: '/api/user' });
    await fastify.register(feedbackRoutes, { prefix: '/api' });
    await fastify.register(searchRoutes, { prefix: '/api/search' });
    await fastify.register(marketPriceRoutes, { prefix: '/api/market-prices' });
    await fastify.register(investmentRoutes, { prefix: '/api/investments' });
    await fastify.register(subscriptionRoutes, { prefix: '/api/subscription' });
    await fastify.register(paymentRoutes, { prefix: '/api/payment' });
    await fastify.register(adminRoutes, { prefix: '/api/admin' });
    await fastify.register(adminUsersRoutes, { prefix: '/api/admin' });
    await fastify.register(adminSubscriptionRoutes, { prefix: '/api/admin' });
    await fastify.register(adminReportRoutes, { prefix: '/api/admin/reports' });
    fastify.addHook('onClose', async () => {
        await prisma.$disconnect();
    });
    return fastify;
}
let cachedApp = null;
async function getApp() {
    if (!cachedApp) {
        cachedApp = await buildApp();
        if (process.env.NODE_ENV !== 'test' && !process.env.VERCEL) {
            startMarketSyncJob();
            startBillProcessorJob();
        }
        if (!process.env.VERCEL) {
            try {
                await cachedApp.listen({ port: config.port, host: '0.0.0.0' });
                console.log(`Server running on http://localhost:${config.port}`);
            }
            catch (err) {
                cachedApp.log.error(err);
                process.exit(1);
            }
        }
    }
    return cachedApp;
}
export { getApp };
let app = null;
const handler = async (req, res) => {
    if (!app) {
        app = await getApp();
    }
    await app.ready();
    app.server.emit('request', req, res);
};
export default handler;
//# sourceMappingURL=index.js.map