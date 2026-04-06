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

  fastify.get('/', getNotificationsHandler);
  fastify.get('/unread', getUnreadNotificationsHandler);
  fastify.get('/unread/count', getUnreadCountHandler);
  fastify.patch('/:id/read', markAsReadHandler);
  fastify.patch('/read-all', markAllAsReadHandler);
  fastify.delete('/:id', deleteNotificationHandler);
}
