import { prisma } from '../../config/prisma.js';
export class UserService {
    async getProfile(userId) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                name: true,
                avatar: true,
                role: true,
                subscriptionTier: true,
                trialStartedAt: true,
                trialEndsAt: true,
                subscriptionStartAt: true,
                subscriptionEndAt: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        if (!user)
            throw new Error('User tidak ditemukan');
        return user;
    }
    async updateProfile(userId, input) {
        return prisma.user.update({
            where: { id: userId },
            data: input,
            select: {
                id: true,
                email: true,
                name: true,
                avatar: true,
                role: true,
                subscriptionTier: true,
                trialStartedAt: true,
                trialEndsAt: true,
                subscriptionStartAt: true,
                subscriptionEndAt: true,
            },
        });
    }
    async getNotificationPreferences(userId) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { preferences: true },
        });
        const defaults = {
            budgetWarning: true,
            goalMilestone: true,
            planReminder: false,
            accountAlert: false,
            dailySummary: false,
            recurringTransaction: false,
        };
        return { ...defaults, ...(user?.preferences || {}) };
    }
    async updateNotificationPreferences(userId, preferences) {
        const current = await prisma.user.findUnique({
            where: { id: userId },
            select: { preferences: true },
        });
        const currentPrefs = current?.preferences || {};
        return prisma.user.update({
            where: { id: userId },
            data: {
                preferences: { ...currentPrefs, ...preferences },
            },
            select: { preferences: true },
        });
    }
}
export const userService = new UserService();
