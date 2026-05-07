import type { FastifyRequest, FastifyReply } from 'fastify';
import { authService } from './service.js';
import { registerSchema, loginSchema } from './schemas.js';

export async function registerHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const input = registerSchema.parse(request.body);
  const user = await authService.register(input);
  
  const token = await reply.jwtSign({
    id: user.id,
    email: user.email,
    name: user.name,
  });
  
  return reply.status(201).send({ user, token });
}

export async function loginHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const input = loginSchema.parse(request.body);
  const user = await authService.login(input);
  
  const token = await reply.jwtSign({
    id: user.id,
    email: user.email,
    name: user.name,
  });
  
  return reply.send({ user, token });
}

export async function meHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const user = await authService.getProfile(request.user.id);
  return reply.send({ user });
}

export async function changePasswordHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { currentPassword, newPassword } = request.body as { currentPassword: string; newPassword: string };
  const result = await authService.changePassword(request.user.id, currentPassword, newPassword);
  return reply.send(result);
}

export async function forgotPasswordHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { email } = request.body as { email: string };
  const result = await authService.forgotPassword(email);
  return reply.send(result);
}

export async function resetPasswordHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { token, password } = request.body as { token: string; password: string };
  const result = await authService.resetPassword(token, password);
  return reply.send(result);
}
