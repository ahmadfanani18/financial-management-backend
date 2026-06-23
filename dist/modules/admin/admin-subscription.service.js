import { prisma } from '../../config/prisma.js';
import { sendRenewalReminderEmail } from '../../utils/email.service.js';
export const adminSubscriptionService = {
    async getOverview() {
        const [totalUsers, proUsers, pendingPayments, expiringSoon] = await Promise.all([
            prisma.user.count(),
            prisma.user.count({ where: { subscriptionTier: 'PRO' } }),
            prisma.payment.count({ where: { status: 'PENDING' } }),
            prisma.user.count({
                where: {
                    subscriptionTier: 'PRO',
                    subscriptionEndAt: {
                        lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                        gte: new Date(),
                    },
                },
            }),
        ]);
        return { totalUsers, freeUsers: totalUsers - proUsers, proUsers, pendingPayments, expiringSoon };
    },
    async extendSubscription(userId, days) {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user)
            throw new Error('User not found');
        const currentExpiry = user.subscriptionEndAt || new Date();
        const newExpiry = new Date(currentExpiry);
        newExpiry.setDate(newExpiry.getDate() + days);
        return prisma.user.update({
            where: { id: userId },
            data: { subscriptionEndAt: newExpiry },
        });
    },
    async changeTier(userId, tier) {
        const subscriptionEndAt = tier === 'PRO'
            ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            : null;
        return prisma.user.update({
            where: { id: userId },
            data: { subscriptionTier: tier, subscriptionEndAt },
        });
    },
    async freezeAccount(userId, reason) {
        return prisma.user.update({
            where: { id: userId },
            data: {
                subscriptionTier: 'FREE',
                subscriptionEndAt: null,
            },
        });
    },
    async cancelSubscription(userId) {
        return prisma.user.update({
            where: { id: userId },
            data: { subscriptionTier: 'FREE', subscriptionEndAt: null },
        });
    },
    async getActiveSubscriptions() {
        return prisma.user.findMany({
            where: { subscriptionTier: 'PRO' },
            select: {
                id: true,
                name: true,
                email: true,
                subscriptionTier: true,
                subscriptionEndAt: true,
                createdAt: true,
            },
            orderBy: { subscriptionEndAt: 'asc' },
        });
    },
    async getPendingPayments() {
        return prisma.payment.findMany({
            where: { status: 'PENDING' },
            include: { user: { select: { id: true, name: true, email: true } } },
            orderBy: { createdAt: 'desc' },
        });
    },
    async getExpiringSubscriptions() {
        return prisma.user.findMany({
            where: {
                subscriptionTier: 'PRO',
                subscriptionEndAt: {
                    lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                    gte: new Date(),
                },
            },
            select: {
                id: true,
                name: true,
                email: true,
                subscriptionEndAt: true,
            },
            orderBy: { subscriptionEndAt: 'asc' },
        });
    },
    async sendRenewalReminders(userIds) {
        const users = await prisma.user.findMany({
            where: { id: { in: userIds } },
            select: {
                id: true,
                email: true,
                name: true,
                subscriptionEndAt: true,
                lastReminderSentAt: true,
            },
        });
        const results = [];
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        for (const user of users) {
            if (!user.email) {
                results.push({ userId: user.id, email: '', status: 'failed', error: 'User tidak memiliki email aktif' });
                continue;
            }
            if (user.lastReminderSentAt && user.lastReminderSentAt > sevenDaysAgo) {
                results.push({ userId: user.id, email: user.email, status: 'skipped', error: 'Reminder sudah dikirim dalam 7 hari terakhir' });
                continue;
            }
            try {
                const expiryDate = user.subscriptionEndAt
                    ? new Date(user.subscriptionEndAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
                    : 'N/A';
                const renewalUrl = `${process.env.APP_URL || 'http://localhost:3000'}/subscription`;
                await sendRenewalReminderEmail({ to: user.email, name: user.name || 'Pengguna', expiryDate, renewalUrl });
                await prisma.user.update({ where: { id: user.id }, data: { lastReminderSentAt: new Date() } });
                results.push({ userId: user.id, email: user.email, status: 'sent' });
            }
            catch (error) {
                results.push({ userId: user.id, email: user.email, status: 'failed', error: error instanceof Error ? error.message : 'Unknown error' });
            }
        }
        return {
            sent: results.filter((r) => r.status === 'sent').length,
            failed: results.filter((r) => r.status === 'failed').length,
            results,
        };
    },
};
