import type { FastifyRequest, FastifyReply } from 'fastify';
import { updateProfileSchema } from './schemas.js';
import { userService } from './service.js';

export async function getProfileHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const user = await userService.getProfile(request.user.id);
  return reply.send({ user });
}

export async function updateProfileHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const input = updateProfileSchema.parse(request.body);
  const user = await userService.updateProfile(request.user.id, input);
  return reply.send({ user });
}