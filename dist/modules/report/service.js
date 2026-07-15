import { prisma } from '../../config/prisma.js';
import Papa from 'papaparse';
export class ReportService {
    async getMonthlyReport(userId, year, month, accountId) {
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0, 23, 59, 59, 999);
        const where = {
            userId,
            date: { gte: startDate, lte: endDate },
        };
        if (accountId) {
            where.OR = [
                { accountId },
                { fromAccountId: accountId },
                { toAccountId: accountId },
            ];
        }
        const transactions = await prisma.transaction.findMany({
            where,
            include: { category: true, account: true },
        });
        const income = transactions.filter(t => t.type === 'INCOME');
        const expense = transactions.filter(t => t.type === 'EXPENSE');
        const transfer = transactions.filter(t => t.type === 'TRANSFER');
        const incomeByCategory = this.groupByCategory(income);
        const expenseByCategory = this.groupByCategory(expense);
        return {
            period: {
                year,
                month,
                label: startDate.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }),
            },
            summary: {
                totalIncome: income.reduce((sum, t) => sum + Number(t.amount), 0),
                totalExpense: expense.reduce((sum, t) => sum + Number(t.amount), 0),
                totalTransfer: transfer.reduce((sum, t) => sum + Number(t.amount), 0),
                balance: income.reduce((sum, t) => sum + Number(t.amount), 0) - expense.reduce((sum, t) => sum + Number(t.amount), 0),
            },
            incomeByCategory,
            expenseByCategory,
            transactions: transactions.slice(0, 50),
        };
    }
    async getCategoryBreakdown(userId, startDate, endDate) {
        const transactions = await prisma.transaction.findMany({
            where: {
                userId,
                type: 'EXPENSE',
                date: { gte: startDate, lte: endDate },
            },
            include: { category: true },
        });
        const breakdown = {};
        const total = transactions.reduce((sum, t) => sum + Number(t.amount), 0);
        transactions.forEach(t => {
            const catName = t.category?.name || 'Other';
            if (!breakdown[catName]) {
                breakdown[catName] = {
                    name: catName,
                    amount: 0,
                    color: t.category?.color || '#6B7280',
                    percentage: 0,
                };
            }
            breakdown[catName].amount += Number(t.amount);
        });
        Object.values(breakdown).forEach(cat => {
            cat.percentage = total > 0 ? Math.round((cat.amount / total) * 100) : 0;
        });
        return {
            total,
            categories: Object.values(breakdown).sort((a, b) => b.amount - a.amount),
        };
    }
    async getTrends(userId, months = 6, accountId) {
        const trends = [];
        const now = new Date();
        for (let i = months - 1; i >= 0; i--) {
            const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0);
            const where = {
                userId,
                date: { gte: date, lte: endDate },
            };
            if (accountId) {
                where.OR = [
                    { accountId },
                    { fromAccountId: accountId },
                    { toAccountId: accountId },
                ];
            }
            const transactions = await prisma.transaction.findMany({
                where,
            });
            const income = transactions.filter(t => t.type === 'INCOME').reduce((sum, t) => sum + Number(t.amount), 0);
            const expense = transactions.filter(t => t.type === 'EXPENSE').reduce((sum, t) => sum + Number(t.amount), 0);
            const trans = transactions.filter(t => t.type === 'TRANSFER').reduce((sum, t) => sum + Number(t.amount), 0);
            trends.push({
                month: date.toLocaleDateString('id-ID', { month: 'short' }),
                year: date.getFullYear(),
                income: Math.round(income),
                expense: Math.round(expense),
                transfer: Math.round(trans),
                balance: Math.round(income - expense),
            });
        }
        return { trends };
    }
    async getCashFlow(userId, startDate, endDate) {
        const transactions = await prisma.transaction.findMany({
            where: {
                userId,
                date: { gte: startDate, lte: endDate },
            },
            include: { account: true },
        });
        const dailyFlow = {};
        transactions.forEach(t => {
            const dateKey = new Date(t.date).toISOString().split('T')[0];
            if (!dailyFlow[dateKey]) {
                dailyFlow[dateKey] = { income: 0, expense: 0 };
            }
            if (t.type === 'INCOME') {
                dailyFlow[dateKey].income += Number(t.amount);
            }
            else if (t.type === 'EXPENSE') {
                dailyFlow[dateKey].expense += Number(t.amount);
            }
        });
        const sortedDays = Object.entries(dailyFlow)
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([date, data]) => ({
            date,
            income: Math.round(data.income),
            expense: Math.round(data.expense),
            balance: Math.round(data.income - data.expense),
        }));
        return { dailyFlow: sortedDays };
    }
    async getMutations(userId, params) {
        const account = await prisma.account.findFirst({
            where: { id: params.accountId, userId },
        });
        if (!account)
            throw new Error('Akun tidak ditemukan');
        const where = {
            OR: [
                { accountId: params.accountId },
                { fromAccountId: params.accountId },
                { toAccountId: params.accountId },
            ],
            userId,
            date: { gte: params.startDate, lte: params.endDate },
        };
        if (params.search) {
            where.description = { contains: params.search, mode: 'insensitive' };
        }
        const [transactions, total] = await Promise.all([
            prisma.transaction.findMany({
                where,
                skip: (params.page - 1) * params.limit,
                take: params.limit,
                orderBy: { date: 'asc' },
                select: {
                    id: true,
                    date: true,
                    description: true,
                    type: true,
                    amount: true,
                    adminFee: true,
                    fromAccountId: true,
                    toAccountId: true,
                    category: { select: { name: true } },
                    toAccount: { select: { name: true } },
                },
            }),
            prisma.transaction.count({ where }),
        ]);
        let totalIncome = 0;
        let totalExpense = 0;
        let transferIn = 0;
        let transferOut = 0;
        for (const t of transactions) {
            if (t.type === 'INCOME') {
                totalIncome += Number(t.amount);
            }
            else if (t.type === 'EXPENSE') {
                totalExpense += Number(t.amount);
            }
            else if (t.type === 'TRANSFER') {
                if (t.fromAccountId === params.accountId) {
                    transferOut += Number(t.amount);
                }
                else if (t.toAccountId === params.accountId) {
                    transferIn += Number(t.amount);
                }
            }
        }
        const currentBalance = Number(account.balance);
        const startingBalance = 0;
        const endingBalance = currentBalance;
        let runningBalance = startingBalance;
        const transactionsWithBalance = transactions.map(t => {
            let change = 0;
            if (t.type === 'INCOME') {
                change = Number(t.amount);
            }
            else if (t.type === 'EXPENSE') {
                change = -Number(t.amount);
            }
            else if (t.type === 'TRANSFER') {
                if (t.fromAccountId === params.accountId) {
                    change = -(Number(t.amount) + Number(t.adminFee || 0));
                }
                else if (t.toAccountId === params.accountId) {
                    change = Number(t.amount);
                }
            }
            runningBalance += change;
            return {
                id: t.id,
                date: t.date.toISOString(),
                description: t.description,
                type: t.type,
                amount: Number(t.amount),
                adminFee: t.adminFee ? Number(t.adminFee) : undefined,
                category: t.category ? { name: t.category.name } : null,
                toAccount: t.type === 'TRANSFER' && t.toAccountId !== params.accountId
                    ? { name: t.toAccount?.name || '' }
                    : null,
                runningBalance,
            };
        });
        return {
            account: { id: account.id, name: account.name, type: account.type, currentBalance: Number(account.balance) },
            startingBalance,
            endingBalance: runningBalance,
            totalIncome,
            totalExpense,
            totalTransfer: transferIn - transferOut,
            transactions: transactionsWithBalance,
            pagination: {
                page: params.page,
                limit: params.limit,
                total,
                totalPages: Math.ceil(total / params.limit),
            },
        };
    }
    async getNetWorth(userId) {
        const accounts = await prisma.account.findMany({
            where: { userId, isArchived: false },
        });
        const totalAssets = accounts
            .filter(a => ['BANK', 'EWALLET', 'CASH'].includes(a.type))
            .reduce((sum, a) => sum + Number(a.balance), 0);
        const totalLiabilities = accounts
            .filter(a => a.type === 'CREDIT_CARD')
            .reduce((sum, a) => sum + Number(a.balance), 0);
        const investments = accounts
            .filter(a => a.type === 'INVESTMENT')
            .reduce((sum, a) => sum + Number(a.balance), 0);
        return {
            totalAssets: Math.round(totalAssets),
            totalLiabilities: Math.round(totalLiabilities),
            investments: Math.round(investments),
            netWorth: Math.round(totalAssets - totalLiabilities),
        };
    }
    groupByCategory(transactions) {
        const grouped = {};
        transactions.forEach(t => {
            const catName = t.category?.name || 'Other';
            if (!grouped[catName]) {
                grouped[catName] = { name: catName, amount: 0, color: t.category?.color || '#6B7280' };
            }
            grouped[catName].amount += Number(t.amount);
        });
        return Object.values(grouped).sort((a, b) => b.amount - a.amount);
    }
    async getInvestmentSummary(userId, accountId) {
        const holdings = await prisma.holding.findMany({
            where: {
                account: { userId, type: 'INVESTMENT', isArchived: false },
                ...(accountId ? { accountId } : {}),
            },
            include: { account: { select: { id: true, name: true } } },
        });
        const num = (val) => Number(val?.toString() ?? 0);
        const totalValue = holdings.reduce((sum, h) => {
            const shares = num(h.quantity);
            const currentPrice = num(h.avgBuyPrice);
            return sum + (shares * currentPrice);
        }, 0);
        const totalInvested = holdings.reduce((sum, h) => {
            const shares = num(h.quantity);
            const avgPrice = num(h.avgBuyPrice);
            return sum + (shares * avgPrice);
        }, 0);
        const totalPnL = totalValue - totalInvested;
        const totalPnLPercent = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;
        return {
            totalValue: Math.round(totalValue),
            totalPnL: Math.round(totalPnL),
            totalPnLPercent: Math.round(totalPnLPercent * 100) / 100,
            holdingsCount: holdings.length,
            holdings: holdings.map(h => ({
                id: h.id,
                symbol: h.symbol,
                name: h.symbol,
                shares: num(h.quantity),
                avgPrice: num(h.avgBuyPrice),
                currentPrice: num(h.avgBuyPrice),
                value: Math.round(num(h.quantity) * num(h.avgBuyPrice)),
                pnl: 0,
                pnlPercent: 0,
            })),
        };
    }
    async getInvestmentPerformance(userId, months = 6, accountId) {
        const performance = [];
        const now = new Date();
        for (let i = months - 1; i >= 0; i--) {
            const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0);
            const holdings = await prisma.holding.findMany({
                where: {
                    account: { userId, type: 'INVESTMENT' },
                    ...(accountId ? { accountId } : {}),
                    createdAt: { lte: endDate },
                },
            });
            const value = holdings.reduce((sum, h) => {
                const shares = Number(h.quantity?.toString() ?? 0);
                const price = Number(h.avgBuyPrice?.toString() ?? 0);
                return sum + (shares * price);
            }, 0);
            performance.push({
                month: date.toLocaleDateString('id-ID', { month: 'short' }),
                value: Math.round(value),
            });
        }
        return { performance };
    }
    async getInvestmentTransactions(userId, params) {
        const where = {
            account: { userId },
        };
        if (params.accountId)
            where.accountId = params.accountId;
        if (params.startDate || params.endDate) {
            where.transactionDate = {};
            if (params.startDate)
                where.transactionDate.gte = params.startDate;
            if (params.endDate)
                where.transactionDate.lte = params.endDate;
        }
        const [transactions, total] = await Promise.all([
            prisma.investmentTransaction.findMany({
                where,
                orderBy: { transactionDate: 'desc' },
                skip: (params.page - 1) * params.limit,
                take: params.limit,
            }),
            prisma.investmentTransaction.count({ where }),
        ]);
        return {
            transactions: transactions.map(t => ({
                id: t.id,
                date: t.transactionDate.toISOString(),
                type: t.type,
                symbol: t.symbol,
                quantity: t.quantity,
                pricePerShare: Number(t.pricePerShare),
                brokerFee: Number(t.brokerFee),
            })),
            pagination: {
                page: params.page,
                limit: params.limit,
                total,
                totalPages: Math.ceil(total / params.limit),
            },
        };
    }
    async exportTransactions(userId, year, month) {
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0, 23, 59, 59);
        const transactions = await prisma.transaction.findMany({
            where: {
                userId,
                date: { gte: startDate, lte: endDate },
            },
            include: {
                account: { select: { name: true } },
                category: { select: { name: true } },
            },
            orderBy: { date: 'desc' },
        });
        const data = transactions.map((t) => ({
            Tanggal: t.date.toISOString().split('T')[0],
            Deskripsi: t.description,
            Kategori: t.category?.name || 'Tanpa Kategori',
            Akun: t.account?.name || 'Tanpa Akun',
            Tipe: t.type === 'INCOME' ? 'Pemasukan' : t.type === 'EXPENSE' ? 'Pengeluaran' : 'Transfer',
            Jumlah: t.amount,
        }));
        return Papa.unparse(data, {
            header: true,
            delimiter: ';',
        });
    }
}
export const reportService = new ReportService();
//# sourceMappingURL=service.js.map