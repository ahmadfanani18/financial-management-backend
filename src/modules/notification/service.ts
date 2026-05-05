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

  async createPlanReminder(userId: string, planName: string, dueDate: Date) {
    return this.create(userId, {
      title: 'Plan Due Soon',
      message: `Plan "${planName}" akan jatuh tempo pada ${dueDate.toLocaleDateString('id-ID')}.`,
      type: 'PLAN_REMINDER',
    });
  }

  async createAccountAlert(userId: string, accountName: string, changeType: 'increase' | 'decrease', amount: number) {
    const direction = changeType === 'increase' ? 'meningkat' : 'menurun';
    return this.create(userId, {
      title: 'Perubahan Saldo',
      message: `Saldo ${accountName} ${direction} sebesar Rp ${amount.toLocaleString('id-ID')}.`,
      type: 'ACCOUNT_ALERT',
    });
  }

  async createDailySummary(userId: string, totalExpense: number, transactionCount: number) {
    return this.create(userId, {
      title: 'Ringkasan Harian',
      message: `Hari ini Anda telah mencatat ${transactionCount} transaksi dengan total pengeluaran Rp ${totalExpense.toLocaleString('id-ID')}.`,
      type: 'DAILY_SUMMARY',
    });
  }

  async createRecurringReminder(userId: string, description: string, nextDate: Date) {
    return this.create(userId, {
      title: 'Transaksi Berulang',
      message: `Ingat untuk mencatat: ${description} pada ${nextDate.toLocaleDateString('id-ID')}.`,
      type: 'RECURRING_TRANSACTION',
    });
  }

  async shouldNotify(userId: string, notificationType: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { preferences: true },
    });
    const prefs = (user?.preferences as Record<string, boolean>) || {};

    const preferenceKeyMap: Record<string, string> = {
      'BUDGET_WARNING': 'budgetWarning',
      'GOAL_MILESTONE': 'goalMilestone',
      'PLAN_REMINDER': 'planReminder',
      'ACCOUNT_ALERT': 'accountAlert',
      'DAILY_SUMMARY': 'dailySummary',
      'RECURRING_TRANSACTION': 'recurringTransaction',
    };

    const prefKey = preferenceKeyMap[notificationType];
    return prefKey ? prefs[prefKey] !== false : true;
  }
}

export const notificationService = new NotificationService();
