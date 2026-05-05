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
}

export const userService = new UserService();