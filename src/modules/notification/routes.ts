import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/auth.js';
import {
  getNotificationsHandler,
  getUnreadNotificationsHandler,
  getUnreadCountHandler,
  markAsReadHandler,
  markAllAsReadHandler,
  deleteNotificationHandler,
} from './controller.js';

export async function notificationRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  fastify.get('/', {
    schema: {
      response: { 200: { type: 'object', properties: { notifications: { type: 'array' } } } },
    },
  }, getNotificationsHandler);

  fastify.get('/unread', {
    schema: {
      response: { 200: { type: 'object', properties: { notifications: { type: 'array' } } } },
    },
  }, getUnreadNotificationsHandler);

  fastify.get('/unread/count', {
    schema: {
      response: { 200: { type: 'object', properties: { count: { type: 'number' } } } },
    },
  }, getUnreadCountHandler);

  fastify.patch('/:id/read', {
    schema: {
      params: { type: 'object', properties: { id: { type: 'string', format: 'uuid' } } },
    },
  }, markAsReadHandler);

  fastify.patch('/read-all', markAllAsReadHandler);

  fastify.delete('/:id', {
    schema: {
      params: { type: 'object', properties: { id: { type: 'string', format: 'uuid' } } },
    },
  }, deleteNotificationHandler);
}
