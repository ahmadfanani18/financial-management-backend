import { prisma } from '../../config/prisma.js';
export class CategoryService {
    async getAll(userId) {
        return prisma.category.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
        });
    }
    async getById(id, userId) {
        const category = await prisma.category.findFirst({
            where: { id, userId },
        });
        if (!category)
            throw new Error('Kategori tidak ditemukan');
        return category;
    }
    async create(userId, input) {
        const icon = input.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
        return prisma.category.create({
            data: {
                ...input,
                userId,
                isDefault: false,
                icon: input.icon || icon,
            },
        });
    }
    async update(id, userId, input) {
        await this.getById(id, userId);
        return prisma.category.update({
            where: { id },
            data: input,
        });
    }
    async delete(id, userId) {
        const category = await this.getById(id, userId);
        if (category.isDefault) {
            throw new Error('Tidak dapat menghapus kategori default');
        }
        await prisma.category.delete({ where: { id } });
    }
    async getByType(userId, type) {
        return prisma.category.findMany({
            where: { userId, type },
            orderBy: { name: 'asc' },
        });
    }
}
export const categoryService = new CategoryService();
//# sourceMappingURL=service.js.map