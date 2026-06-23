import { authenticate, requireAdmin } from '../../middleware/auth.js';
import { adminUsersService } from './admin-users.service.js';
export async function adminUsersRoutes(fastify) {
    fastify.get('/users', {
        preHandler: [authenticate, requireAdmin],
    }, async (request, reply) => {
        const { page, limit, search, role, tier } = request.query;
        try {
            const result = await adminUsersService.listUsers({ page, limit, search, role, tier });
            return reply.send(result);
        }
        catch (error) {
            console.error('Error listing users:', error);
            return reply.status(500).send({ error: 'Failed to list users' });
        }
    });
    fastify.get('/users/:id', {
        preHandler: [authenticate, requireAdmin],
    }, async (request, reply) => {
        try {
            const user = await adminUsersService.getUserById(request.params.id);
            if (!user)
                return reply.status(404).send({ error: 'User not found' });
            return reply.send(user);
        }
        catch (error) {
            return reply.status(500).send({ error: 'Failed to get user' });
        }
    });
    fastify.patch('/users/:id', {
        preHandler: [authenticate, requireAdmin],
    }, async (request, reply) => {
        try {
            const user = await adminUsersService.updateUser(request.params.id, request.body);
            return reply.send(user);
        }
        catch (error) {
            return reply.status(500).send({ error: 'Failed to update user' });
        }
    });
    fastify.delete('/users/:id', {
        preHandler: [authenticate, requireAdmin],
    }, async (request, reply) => {
        try {
            await adminUsersService.deleteUser(request.params.id);
            return reply.send({ success: true });
        }
        catch (error) {
            return reply.status(500).send({ error: 'Failed to delete user' });
        }
    });
    fastify.post('/users/:id/reset-password', {
        preHandler: [authenticate, requireAdmin],
    }, async (request, reply) => {
        try {
            const result = await adminUsersService.resetPassword(request.params.id);
            return reply.send(result);
        }
        catch (error) {
            return reply.status(500).send({ error: 'Failed to reset password' });
        }
    });
    fastify.get('/activity/:userId', {
        preHandler: [authenticate, requireAdmin],
    }, async (request, reply) => {
        try {
            const activity = await adminUsersService.getUserActivity(request.params.userId);
            return reply.send(activity);
        }
        catch (error) {
            return reply.status(500).send({ error: 'Failed to get activity' });
        }
    });
}
