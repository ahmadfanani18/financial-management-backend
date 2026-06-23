import type { CreateBudgetInput, UpdateBudgetInput } from './schemas.js';
export declare class BudgetService {
    getAll(userId: string): Promise<({
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
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        categoryId: string;
        amount: import("@prisma/client/runtime/library").Decimal;
        endDate: Date | null;
        startDate: Date;
        spent: import("@prisma/client/runtime/library").Decimal;
        period: import("@prisma/client").$Enums.BudgetPeriod;
        warningThreshold: number;
        isActive: boolean;
    })[]>;
    getById(id: string, userId: string): Promise<{
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
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        categoryId: string;
        amount: import("@prisma/client/runtime/library").Decimal;
        endDate: Date | null;
        startDate: Date;
        spent: import("@prisma/client/runtime/library").Decimal;
        period: import("@prisma/client").$Enums.BudgetPeriod;
        warningThreshold: number;
        isActive: boolean;
    }>;
    create(userId: string, input: CreateBudgetInput): Promise<{
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
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        categoryId: string;
        amount: import("@prisma/client/runtime/library").Decimal;
        endDate: Date | null;
        startDate: Date;
        spent: import("@prisma/client/runtime/library").Decimal;
        period: import("@prisma/client").$Enums.BudgetPeriod;
        warningThreshold: number;
        isActive: boolean;
    }>;
    update(id: string, userId: string, input: UpdateBudgetInput): Promise<{
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
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        categoryId: string;
        amount: import("@prisma/client/runtime/library").Decimal;
        endDate: Date | null;
        startDate: Date;
        spent: import("@prisma/client/runtime/library").Decimal;
        period: import("@prisma/client").$Enums.BudgetPeriod;
        warningThreshold: number;
        isActive: boolean;
    }>;
    updateSpent(id: string, userId: string, spent: number): Promise<{
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
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        categoryId: string;
        amount: import("@prisma/client/runtime/library").Decimal;
        endDate: Date | null;
        startDate: Date;
        spent: import("@prisma/client/runtime/library").Decimal;
        period: import("@prisma/client").$Enums.BudgetPeriod;
        warningThreshold: number;
        isActive: boolean;
    }>;
    delete(id: string, userId: string): Promise<void>;
    getSpending(userId: string, budgetId: string): Promise<{
        budget: {
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
            };
        } & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            userId: string;
            categoryId: string;
            amount: import("@prisma/client/runtime/library").Decimal;
            endDate: Date | null;
            startDate: Date;
            spent: import("@prisma/client/runtime/library").Decimal;
            period: import("@prisma/client").$Enums.BudgetPeriod;
            warningThreshold: number;
            isActive: boolean;
        };
        spent: number;
        remaining: number;
        percentage: number;
        isOverBudget: boolean;
        isWarning: boolean;
    }>;
    getAllWithSpending(userId: string): Promise<{
        spent: number;
        remaining: number;
        percentage: number;
        isOverBudget: boolean;
        isWarning: boolean;
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
        };
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        categoryId: string;
        amount: import("@prisma/client/runtime/library").Decimal;
        endDate: Date | null;
        startDate: Date;
        period: import("@prisma/client").$Enums.BudgetPeriod;
        warningThreshold: number;
        isActive: boolean;
    }[]>;
    getSummary(userId: string): Promise<{
        totalBudget: number;
        totalSpent: number;
        remaining: number;
        budgetCount: number;
    }>;
}
export declare const budgetService: BudgetService;
//# sourceMappingURL=service.d.ts.map