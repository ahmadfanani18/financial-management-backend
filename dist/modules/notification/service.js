import { prisma } from '../../config/prisma.js';
export class NotificationService {
    async getAll(userId) {
        return prisma.notification.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
        });
    }
    async getUnread(userId) {
        return prisma.notification.findMany({
            where: { userId, isRead: false },
            orderBy: { createdAt: 'desc' },
        });
    }
    async getById(id, userId) {
        const notification = await prisma.notification.findFirst({
            where: { id, userId },
        });
        if (!notification)
            throw new Error('Notifikasi tidak ditemukan');
        return notification;
    }
    async create(userId, input) {
        return prisma.notification.create({
            data: { ...input, userId },
        });
    }
    async markAsRead(id, userId) {
        await this.getById(id, userId);
        return prisma.notification.update({
            where: { id },
            data: { isRead: true },
        });
    }
    async markAllAsRead(userId) {
        return prisma.notification.updateMany({
            where: { userId, isRead: false },
            data: { isRead: true },
        });
    }
    async delete(id, userId) {
        await this.getById(id, userId);
        await prisma.notification.delete({ where: { id } });
    }
    async getUnreadCount(userId) {
        const count = await prisma.notification.count({
            where: { userId, isRead: false },
        });
        return { count };
    }
    async createBudgetWarning(userId, categoryName, percentage) {
        return this.create(userId, {
            title: 'Peringatan Anggaran',
            message: `Pengeluaran untuk ${categoryName} telah mencapai ${percentage}% dari anggaran.`,
            type: 'BUDGET_WARNING',
        });
    }
    async createGoalMilestone(userId, goalName, percentage) {
        return this.create(userId, {
            title: 'Milestone Tercapai',
            message: `Target tabungan "${goalName}" telah mencapai ${percentage}%!`,
            type: 'GOAL_MILESTONE',
        });
    }
    async createPlanReminder(userId, planName, dueDate) {
        return this.create(userId, {
            title: 'Plan Due Soon',
            message: `Plan "${planName}" akan jatuh tempo pada ${dueDate.toLocaleDateString('id-ID')}.`,
            type: 'PLAN_REMINDER',
        });
    }
    async createAccountAlert(userId, accountName, changeType, amount) {
        const direction = changeType === 'increase' ? 'meningkat' : 'menurun';
        return this.create(userId, {
            title: 'Perubahan Saldo',
            message: `Saldo ${accountName} ${direction} sebesar Rp ${amount.toLocaleString('id-ID')}.`,
            type: 'ACCOUNT_ALERT',
        });
    }
    async createDailySummary(userId, totalExpense, transactionCount) {
        return this.create(userId, {
            title: 'Ringkasan Harian',
            message: `Hari ini Anda telah mencatat ${transactionCount} transaksi dengan total pengeluaran Rp ${totalExpense.toLocaleString('id-ID')}.`,
            type: 'DAILY_SUMMARY',
        });
    }
    async createRecurringReminder(userId, description, nextDate) {
        return this.create(userId, {
            title: 'Transaksi Berulang',
            message: `Ingat untuk mencatat: ${description} pada ${nextDate.toLocaleDateString('id-ID')}.`,
            type: 'RECURRING_TRANSACTION',
        });
    }
    async shouldNotify(userId, notificationType) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { preferences: true },
        });
        const prefs = user?.preferences || {};
        const preferenceKeyMap = {
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
