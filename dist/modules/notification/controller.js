import { notificationService } from './service.js';
import { notificationIdSchema } from './schemas.js';
export async function getNotificationsHandler(request, reply) {
    const notifications = await notificationService.getAll(request.user.id);
    return reply.send({ notifications });
}
export async function getUnreadNotificationsHandler(request, reply) {
    const notifications = await notificationService.getUnread(request.user.id);
    return reply.send({ notifications });
}
export async function getUnreadCountHandler(request, reply) {
    const result = await notificationService.getUnreadCount(request.user.id);
    return reply.send(result);
}
export async function markAsReadHandler(request, reply) {
    const { id } = notificationIdSchema.parse(request.params);
    const notification = await notificationService.markAsRead(id, request.user.id);
    return reply.send({ notification });
}
export async function markAllAsReadHandler(request, reply) {
    await notificationService.markAllAsRead(request.user.id);
    return reply.send({ success: true });
}
export async function deleteNotificationHandler(request, reply) {
    const { id } = notificationIdSchema.parse(request.params);
    await notificationService.delete(id, request.user.id);
    return reply.status(204).send();
}
