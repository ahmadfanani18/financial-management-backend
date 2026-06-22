import type { FastifyRequest, FastifyReply } from 'fastify';
import { marketPriceService } from './service.js';
import { symbolsQuerySchema, searchQuerySchema } from './schemas.js';

export async function getMarketPricesHandler(
  request: FastifyRequest<{ Querystring: { symbols?: string } }>,
  reply: FastifyReply
) {
  const { symbols } = symbolsQuerySchema.parse(request.query);
  
  if (!symbols) {
    return reply.send({ prices: [] });
  }

  const symbolList = symbols.split(',');
  const prices = await marketPriceService.getBySymbols(symbolList);
  
  return reply.send({
    prices: prices.map((p) => ({
      symbol: p.symbol,
      price: p.price,
      updatedAt: p.updatedAt,
    })),
  });
}

export async function searchMarketPricesHandler(
  request: FastifyRequest<{ Querystring: { query: string; type?: string } }>,
  reply: FastifyReply
) {
  const { query, type } = searchQuerySchema.parse(request.query);
  const results = await marketPriceService.search(query, type as any);
  
  return reply.send({ results });
}
