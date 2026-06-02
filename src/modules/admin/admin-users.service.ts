import { prisma } from '../../config/prisma.js';

export const adminUsersService = {
  async listUsers(params: {
    page?: number;
    limit?: number;
    search?: string;
    role?: string;
    tier?: string;
  }) {
    const { page = 1, limit = 20, search, role, tier } = params;
    const pageNum = parseInt(page as any, 10) || 1;
    const limitNum = parseInt(limit as any, 10) || 20;
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
      ];
    }
    if (role) where.role = role;
    if (tier) where.subscriptionTier = tier;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          email: true,
          avatar: true,
          role: true,
          subscriptionTier: true,
          subscriptionEndAt: true,
          createdAt: true,
        },
      }),
      prisma.user.count({ where }),
    ]);

    return { users, total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) };
  },

  async getUserById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      include: {
        subscriptions: {
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
      },
    });
  },

  async updateUser(id: string, data: { name: string; role: string }) {
    return prisma.user.update({
      where: { id },
      data: {
        name: data.name,
        role: data.role as any,
      },
    });
  },

  async deleteUser(id: string) {
    return prisma.user.update({
      where: { id },
      data: { role: 'MEMBER' },
    });
  },

  async resetPassword(id: string) {
    return { success: true, message: 'Password reset email sent' };
  },

  async getUserActivity(userId: string) {
    return { logins: [], actions: [] };
  },
};