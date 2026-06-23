import { registerHandler, loginHandler, meHandler, changePasswordHandler, forgotPasswordHandler, resetPasswordHandler } from './controller.js';
import { authenticate } from '../../middleware/auth.js';
export async function authRoutes(fastify) {
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
    fastify.post('/login', loginHandler);
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
}
