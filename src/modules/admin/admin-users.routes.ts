import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate, requireAdmin } from '../../middleware/auth.js';
import { adminUsersService } from './admin-users.service.js';

interface UserParams {
  id: string;
}

interface UpdateUserBody {
  name: string;
  role: string;
}

export async function adminUsersRoutes(fastify: FastifyInstance) {
  fastify.get('/users', {
    preHandler: [authenticate, requireAdmin],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { page, limit, search, role, tier } = request.query as any;
    try {
      const result = await adminUsersService.listUsers({ page, limit, search, role, tier });
      return reply.send(result);
    } catch (error) {
      console.error('Error listing users:', error);
      return reply.status(500).send({ error: 'Failed to list users' });
    }
  });

  fastify.get('/users/:id', {
    preHandler: [authenticate, requireAdmin],
  }, async (request: FastifyRequest<{ Params: UserParams }>, reply: FastifyReply) => {
    try {
      const user = await adminUsersService.getUserById(request.params.id);
      if (!user) return reply.status(404).send({ error: 'User not found' });
      return reply.send(user);
    } catch (error) {
      return reply.status(500).send({ error: 'Failed to get user' });
    }
  });

  fastify.patch('/users/:id', {
    preHandler: [authenticate, requireAdmin],
  }, async (request: FastifyRequest<{ Params: UserParams; Body: UpdateUserBody }>, reply: FastifyReply) => {
    try {
      const user = await adminUsersService.updateUser(request.params.id, request.body);
      return reply.send(user);
    } catch (error) {
      return reply.status(500).send({ error: 'Failed to update user' });
    }
  });

  fastify.delete('/users/:id', {
    preHandler: [authenticate, requireAdmin],
  }, async (request: FastifyRequest<{ Params: UserParams }>, reply: FastifyReply) => {
    try {
      await adminUsersService.deleteUser(request.params.id);
      return reply.send({ success: true });
    } catch (error) {
      return reply.status(500).send({ error: 'Failed to delete user' });
    }
  });

  fastify.post('/users/:id/reset-password', {
    preHandler: [authenticate, requireAdmin],
  }, async (request: FastifyRequest<{ Params: UserParams }>, reply: FastifyReply) => {
    try {
      const result = await adminUsersService.resetPassword(request.params.id);
      return reply.send(result);
    } catch (error) {
      return reply.status(500).send({ error: 'Failed to reset password' });
    }
  });

  fastify.get('/activity/:userId', {
    preHandler: [authenticate, requireAdmin],
  }, async (request: FastifyRequest<{ Params: { userId: string } }>, reply: FastifyReply) => {
    try {
      const activity = await adminUsersService.getUserActivity(request.params.userId);
      return reply.send(activity);
    } catch (error) {
      return reply.status(500).send({ error: 'Failed to get activity' });
    }
  });
}