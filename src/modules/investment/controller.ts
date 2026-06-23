import type { FastifyRequest, FastifyReply } from 'fastify';
import { investmentService } from './service.js';
import {
  getHoldingsSchema,
  createHoldingSchema,
  updateHoldingSchema,
  holdingIdSchema,
  sellHoldingSchema,
} from './schemas.js';

export async function getHoldingsHandler(
  request: FastifyRequest<{ Querystring: { accountId: string } }>,
  reply: FastifyReply
) {
  const { accountId } = getHoldingsSchema.parse(request.query);
  const result = await investmentService.getHoldings(accountId, request.user.id);
  return reply.send(result);
}

export async function createHoldingHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const input = createHoldingSchema.parse(request.body);
  
  try {
    const holding = await investmentService.createHolding(request.user.id, input);
    return reply.status(201).send({ holding });
  } catch (error: any) {
    if (error.message.includes('sudah ada') || error.message.includes('Saldo tidak cukup')) {
      return reply.status(409).send({ error: error.message });
    }
    throw error;
  }
}

export async function updateHoldingHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const { id } = holdingIdSchema.parse(request.params);
  const input = updateHoldingSchema.parse(request.body);
  
  try {
    const holding = await investmentService.updateHolding(id, request.user.id, input);
    return reply.send({ holding });
  } catch (error: any) {
    if (error.message.includes('Saldo tidak cukup')) {
      return reply.status(400).send({ error: error.message });
    }
    throw error;
  }
}

export async function deleteHoldingHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const { id } = holdingIdSchema.parse(request.params);
  
  try {
    await investmentService.deleteHolding(id, request.user.id);
    return reply.status(204).send();
  } catch (error: any) {
    if (error.message.includes('tidak ditemukan')) {
      return reply.status(404).send({ error: error.message });
    }
    throw error;
  }
}

export async function sellHoldingHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const { id } = holdingIdSchema.parse(request.params);
  const input = sellHoldingSchema.parse(request.body);
  
  try {
    const result = await investmentService.sellHolding(id, input);
    return reply.send({ success: true, data: result });
  } catch (error: any) {
    if (error.message.includes('tidak ditemukan')) {
      return reply.status(404).send({ error: error.message });
    }
    if (error.message.includes('melebihi posisi')) {
      return reply.status(400).send({ error: error.message });
    }
    throw error;
  }
}