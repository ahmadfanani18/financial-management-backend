import type { FastifyRequest, FastifyReply } from 'fastify';
import { adminReportService } from './service.js';

export async function getUserReportHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const data = await adminReportService.getUserReport();
    return reply.send(data);
  } catch (error) {
    request.log.error({ err: error }, 'Error fetching user report');
    return reply.status(500).send({ error: 'InternalServerError', message: 'An unexpected error occurred' });
  }
}

export async function getSubscriptionReportHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const data = await adminReportService.getSubscriptionReport();
    return reply.send(data);
  } catch (error) {
    request.log.error({ err: error }, 'Error fetching subscription report');
    return reply.status(500).send({ error: 'InternalServerError', message: 'An unexpected error occurred' });
  }
}

export async function getActivityReportHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const data = await adminReportService.getActivityReport();
    return reply.send(data);
  } catch (error) {
    request.log.error({ err: error }, 'Error fetching activity report');
    return reply.status(500).send({ error: 'InternalServerError', message: 'An unexpected error occurred' });
  }
}
