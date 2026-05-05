import { prisma } from '../../config/prisma.js';

export class UserService {
  async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        role: true,
        createdAt: true,
      },
    });
    if (!user) throw new Error('User tidak ditemukan');
    return user;
  }

  async updateProfile(userId: string, input: { name?: string; avatar?: string }) {
    return prisma.user.update({
      where: { id: userId },
      data: input,
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        role: true,
      },
    });
  }

  async getNotificationPreferences(userId: string) {
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
    return { ...defaults, ...(user?.preferences as Record<string, boolean> || {}) };
  }

  async updateNotificationPreferences(userId: string, preferences: Record<string, boolean>) {
    const current = await prisma.user.findUnique({
      where: { id: userId },
      select: { preferences: true },
    });
    const currentPrefs = (current?.preferences as object) || {};

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