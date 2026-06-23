import { prisma } from '../../config/prisma.js';
export class SearchService {
    async search(query, userId) {
        const { q, limit } = query;
        const searchPattern = { contains: q, mode: 'insensitive' };
        const [transactions, accounts, categories, budgets, goals, plans] = await Promise.all([
            prisma.transaction.findMany({
                where: {
                    userId,
                    OR: [
                        { description: searchPattern },
                    ],
                },
                take: limit,
                orderBy: { date: 'desc' },
                select: {
                    id: true,
                    description: true,
                    date: true,
                    amount: true,
                },
            }),
            prisma.account.findMany({
                where: {
                    userId,
                    name: searchPattern,
                },
                take: limit,
                select: {
                    id: true,
                    name: true,
                    type: true,
                },
            }),
            prisma.category.findMany({
                where: {
                    userId,
                    name: searchPattern,
                },
                take: limit,
                select: {
                    id: true,
                    name: true,
                    type: true,
                },
            }),
            prisma.budget.findMany({
                where: {
                    userId,
                    category: { name: searchPattern },
                },
                take: limit,
                include: {
                    category: { select: { name: true } },
                },
            }),
            prisma.goal.findMany({
                where: {
                    userId,
                    name: searchPattern,
                },
                take: limit,
                select: {
                    id: true,
                    name: true,
                    targetAmount: true,
                    currentAmount: true,
                },
            }),
            prisma.plan.findMany({
                where: {
                    userId,
                    name: searchPattern,
                },
                take: limit,
                select: {
                    id: true,
                    name: true,
                    status: true,
                },
            }),
        ]);
        const budgetsFormatted = budgets.map((b) => ({
            id: b.id,
            categoryName: b.category?.name || '',
            amount: b.amount,
        }));
        return {
            transactions,
            accounts,
            categories,
            budgets: budgetsFormatted,
            goals,
            plans,
            total: transactions.length + accounts.length + categories.length +
                budgetsFormatted.length + goals.length + plans.length,
        };
    }
}
export const searchService = new SearchService();
