import { prisma } from '../../config/prisma.js';
import type { CreateNotificationInput, UpdateNotificationInput } from './schemas.js';

export class NotificationService {
  async getAll(userId: string) {
    return prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getUnread(userId: string) {
    return prisma.notification.findMany({
      where: { userId, isRead: false },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getById(id: string, userId: string) {
    const notification = await prisma.notification.findFirst({
      where: { id, userId },
    });
    if (!notification) throw new Error('Notifikasi tidak ditemukan');
    return notification;
  }

  async create(userId: string, input: CreateNotificationInput) {
    return prisma.notification.create({
      data: { ...input, userId },
    });
  }

  async markAsRead(id: string, userId: string) {
    await this.getById(id, userId);
    return prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
  }

  async markAllAsRead(userId: string) {
    return prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }

  async delete(id: string, userId: string) {
    await this.getById(id, userId);
    await prisma.notification.delete({ where: { id } });
  }

  async getUnreadCount(userId: string) {
    const count = await prisma.notification.count({
      where: { userId, isRead: false },
    });
    return { count };
  }

  async createBudgetWarning(userId: string, categoryName: string, percentage: number) {
    return this.create(userId, {
      title: 'Peringatan Anggaran',
      message: `Pengeluaran untuk ${categoryName} telah mencapai ${percentage}% dari anggaran.`,
      type: 'BUDGET_WARNING',
    });
  }

  async createGoalMilestone(userId: string, goalName: string, percentage: number) {
    return this.create(userId, {
      title: 'Milestone Tercapai',
      message: `Target tabungan "${goalName}" telah mencapai ${percentage}%!`,
      type: 'GOAL_MILESTONE',
    });
  }
}

export const notificationService = new NotificationService();
