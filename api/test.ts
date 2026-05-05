import Fastify from 'fastify';

export default async function handler(req: unknown, res: unknown) {
  const vercelRes = res as { status: (code: number) => typeof vercelRes; json: (data: unknown) => void };
  
  const fastify = Fastify({ logger: false });
  
  fastify.get('/api/test', async () => ({ hello: 'world' }));
  
  const result = await fastify.handle({
    method: 'GET',
    url: '/api/test',
    headers: {},
  });
  
  vercelRes.status(200).json(result);
}