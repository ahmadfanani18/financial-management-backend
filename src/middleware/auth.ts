import type { FastifyRequest, FastifyReply } from 'fastify';

export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    await request.jwtVerify();
  } catch (err) {
    return reply.status(401).send({ error: 'Unauthorized' });
  }
}

export async function requireAdmin(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const user = request.user as { role?: string } | undefined;
  if (user?.role !== 'ADMIN') {
    return reply.status(403).send({ error: 'Admin only' });
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: {
      id: string;
      email: string;
      name: string;
      role: string;
    };
    user: {
      id: string;
      email: string;
      name: string;
      role: string;
    };
  }
}
