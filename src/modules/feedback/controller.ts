import type { FastifyRequest, FastifyReply } from 'fastify';
import { feedbackService } from './service.js';
import { createFeedbackSchema, updateFeedbackStatusSchema } from './schemas.js';

export async function createFeedbackHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const userId = request.user.id;
  const input = createFeedbackSchema.parse(request.body);

  const feedback = await feedbackService.create(userId, input);

  return reply.status(201).send({ feedback });
}

export async function getMyFeedbackHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const userId = request.user.id;
  const feedback = await feedbackService.getUserFeedback(userId);

  return { feedback };
}

export async function getAllFeedbackHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const result = await feedbackService.getAllFeedback();

  return result;
}

export async function updateFeedbackStatusHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const { id } = request.params;
  const input = updateFeedbackStatusSchema.parse(request.body);

  const feedback = await feedbackService.updateStatus(id, input);

  return { feedback };
}
