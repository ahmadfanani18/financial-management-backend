export declare class ReportService {
    getMonthlyReport(userId: string, year: number, month: number): Promise<{
        period: {
            year: number;
            month: number;
            label: string;
        };
        summary: {
            totalIncome: number;
            totalExpense: number;
            balance: number;
        };
        incomeByCategory: {
            name: string;
            amount: number;
            color: string;
        }[];
        expenseByCategory: {
            name: string;
            amount: number;
            color: string;
        }[];
        transactions: ({
            account: {
                name: string;
                type: import("@prisma/client").$Enums.AccountType;
                id: string;
                createdAt: Date;
                updatedAt: Date;
                balance: import("@prisma/client/runtime/library").Decimal;
                currency: string;
                icon: string;
                color: string;
                userId: string;
                isArchived: boolean;
            };
            category: {
                name: string;
                type: import("@prisma/client").$Enums.CategoryType;
                id: string;
                createdAt: Date;
                updatedAt: Date;
                icon: string;
                color: string;
                userId: string;
                isDefault: boolean;
            } | null;
        } & {
            type: import("@prisma/client").$Enums.TransactionType;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            date: Date;
            userId: string;
            accountId: string;
            categoryId: string | null;
            amount: import("@prisma/client/runtime/library").Decimal;
            description: string;
            receiptUrl: string | null;
            fromAccountId: string | null;
            toAccountId: string | null;
            isRecurring: boolean;
            recurringPattern: import("@prisma/client/runtime/library").JsonValue | null;
        })[];
    }>;
    getCategoryBreakdown(userId: string, startDate: Date, endDate: Date): Promise<{
        total: number;
        categories: {
            name: string;
            amount: number;
            color: string;
            percentage: number;
        }[];
    }>;
    getTrends(userId: string, months?: number): Promise<{
        trends: {
            month: string;
            year: number;
            income: number;
            expense: number;
            balance: number;
        }[];
    }>;
    getCashFlow(userId: string, startDate: Date, endDate: Date): Promise<{
        dailyFlow: {
            date: string;
            income: number;
            expense: number;
            balance: number;
        }[];
    }>;
    getNetWorth(userId: string): Promise<{
        totalAssets: number;
        totalLiabilities: number;
        investments: number;
        netWorth: number;
    }>;
    private groupByCategory;
    exportTransactions(userId: string, year: number, month: number): Promise<string>;
}
export declare const reportService: ReportService;
//# sourceMappingURL=service.d.ts.map