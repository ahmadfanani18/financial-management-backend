import { prisma } from '../../config/prisma.js';
import type { CreateCategoryInput, UpdateCategoryInput } from './schemas.js';

export class CategoryService {
  async getAll(userId: string) {
    return prisma.category.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getById(id: string, userId: string) {
    const category = await prisma.category.findFirst({
      where: { id, userId },
    });
    if (!category) throw new Error('Kategori tidak ditemukan');
    return category;
  }

  async create(userId: string, input: CreateCategoryInput) {
    return prisma.category.create({
      data: {
        ...input,
        userId,
        isDefault: false,
      },
    });
  }

  async update(id: string, userId: string, input: UpdateCategoryInput) {
    await this.getById(id, userId);
    return prisma.category.update({
      where: { id },
      data: input,
    });
  }

  async delete(id: string, userId: string) {
    const category = await this.getById(id, userId);
    if (category.isDefault) {
      throw new Error('Tidak dapat menghapus kategori default');
    }
    await prisma.category.delete({ where: { id } });
  }

  async getByType(userId: string, type: 'INCOME' | 'EXPENSE') {
    return prisma.category.findMany({
      where: { userId, type },
      orderBy: { name: 'asc' },
    });
  }
}

export const categoryService = new CategoryService();
