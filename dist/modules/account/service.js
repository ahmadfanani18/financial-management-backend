import { prisma } from '../../config/prisma.js';
export class AccountService {
    async getAll(userId) {
        return prisma.account.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
        });
    }
    async getById(id, userId) {
        const account = await prisma.account.findFirst({
            where: { id, userId },
        });
        if (!account)
            throw new Error('Akun tidak ditemukan');
        return account;
    }
    async create(userId, input) {
        return prisma.account.create({
            data: {
                ...input,
                userId,
            },
        });
    }
    async update(id, userId, input) {
        await this.getById(id, userId);
        return prisma.account.update({
            where: { id },
            data: input,
        });
    }
    async delete(id, userId) {
        await this.getById(id, userId);
        await prisma.account.delete({ where: { id } });
    }
    async getTotalBalance(userId) {
        const accounts = await prisma.account.findMany({
            where: { userId, isArchived: false },
            select: { balance: true },
        });
        return accounts.reduce((sum, acc) => sum + Number(acc.balance), 0);
    }
    async archive(id, userId) {
        await this.getById(id, userId);
        return prisma.account.update({
            where: { id },
            data: { isArchived: true },
        });
    }
    async toggleLock(id, userId, isLocked, reason) {
        const account = await this.getById(id, userId);
        return prisma.account.update({
            where: { id },
            data: { isLocked, lockedReason: reason || null },
        });
    }
    async linkToGoal(accountId, userId, goalId) {
        await this.getById(accountId, userId);
        if (goalId) {
            const goal = await prisma.goal.findFirst({ where: { id: goalId, userId } });
            if (!goal)
                throw new Error('Goal tidak ditemukan');
        }
        return prisma.account.update({
            where: { id: accountId },
            data: { linkedGoalId: goalId },
        });
    }
    async getAccountsForGoalSelect(userId) {
        return prisma.account.findMany({
            where: { userId, isArchived: false },
            select: { id: true, name: true, balance: true, isLocked: true },
            orderBy: { name: 'asc' },
        });
    }
}
export const accountService = new AccountService();
