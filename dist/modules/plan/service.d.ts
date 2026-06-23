import type { CreatePlanInput, UpdatePlanInput, CreateMilestoneInput, UpdateMilestoneInput } from './schemas.js';
export declare class PlanService {
    getAll(userId: string): Promise<({
        planBudgets: ({
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
        } & {
            planId: string;
            budgetId: string;
        })[];
        planGoals: ({
            goal: {
                name: string;
                status: import("@prisma/client").$Enums.GoalStatus;
                id: string;
                createdAt: Date;
                updatedAt: Date;
                icon: string;
                color: string;
                userId: string;
                targetAmount: import("@prisma/client/runtime/library").Decimal;
                deadline: Date;
                currentAmount: import("@prisma/client/runtime/library").Decimal;
                isLocked: boolean;
                source: import("@prisma/client").$Enums.GoalSource;
                sourceMilestoneId: string | null;
            };
        } & {
            goalId: string;
            planId: string;
        })[];
        milestones: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            description: string | null;
            targetAmount: import("@prisma/client/runtime/library").Decimal | null;
            goalId: string | null;
            planId: string;
            title: string;
            targetDate: Date;
            isCompleted: boolean;
            completedAt: Date | null;
            order: number;
        }[];
    } & {
        name: string;
        status: import("@prisma/client").$Enums.PlanStatus;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        description: string | null;
        endDate: Date;
        startDate: Date;
    })[]>;
    getById(id: string, userId: string): Promise<{
        planBudgets: ({
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
        } & {
            planId: string;
            budgetId: string;
        })[];
        planGoals: ({
            goal: {
                name: string;
                status: import("@prisma/client").$Enums.GoalStatus;
                id: string;
                createdAt: Date;
                updatedAt: Date;
                icon: string;
                color: string;
                userId: string;
                targetAmount: import("@prisma/client/runtime/library").Decimal;
                deadline: Date;
                currentAmount: import("@prisma/client/runtime/library").Decimal;
                isLocked: boolean;
                source: import("@prisma/client").$Enums.GoalSource;
                sourceMilestoneId: string | null;
            };
        } & {
            goalId: string;
            planId: string;
        })[];
        milestones: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            description: string | null;
            targetAmount: import("@prisma/client/runtime/library").Decimal | null;
            goalId: string | null;
            planId: string;
            title: string;
            targetDate: Date;
            isCompleted: boolean;
            completedAt: Date | null;
            order: number;
        }[];
    } & {
        name: string;
        status: import("@prisma/client").$Enums.PlanStatus;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        description: string | null;
        endDate: Date;
        startDate: Date;
    }>;
    create(userId: string, input: CreatePlanInput): Promise<{
        milestones: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            description: string | null;
            targetAmount: import("@prisma/client/runtime/library").Decimal | null;
            goalId: string | null;
            planId: string;
            title: string;
            targetDate: Date;
            isCompleted: boolean;
            completedAt: Date | null;
            order: number;
        }[];
    } & {
        name: string;
        status: import("@prisma/client").$Enums.PlanStatus;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        description: string | null;
        endDate: Date;
        startDate: Date;
    }>;
    update(id: string, userId: string, input: UpdatePlanInput): Promise<{
        milestones: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            description: string | null;
            targetAmount: import("@prisma/client/runtime/library").Decimal | null;
            goalId: string | null;
            planId: string;
            title: string;
            targetDate: Date;
            isCompleted: boolean;
            completedAt: Date | null;
            order: number;
        }[];
    } & {
        name: string;
        status: import("@prisma/client").$Enums.PlanStatus;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        description: string | null;
        endDate: Date;
        startDate: Date;
    }>;
    delete(id: string, userId: string): Promise<void>;
    addMilestone(planId: string, userId: string, input: CreateMilestoneInput): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        targetAmount: import("@prisma/client/runtime/library").Decimal | null;
        goalId: string | null;
        planId: string;
        title: string;
        targetDate: Date;
        isCompleted: boolean;
        completedAt: Date | null;
        order: number;
    }>;
    updateMilestone(milestoneId: string, userId: string, input: UpdateMilestoneInput): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        targetAmount: import("@prisma/client/runtime/library").Decimal | null;
        goalId: string | null;
        planId: string;
        title: string;
        targetDate: Date;
        isCompleted: boolean;
        completedAt: Date | null;
        order: number;
    }>;
    deleteMilestone(milestoneId: string, userId: string): Promise<void>;
    completeMilestone(milestoneId: string, userId: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        targetAmount: import("@prisma/client/runtime/library").Decimal | null;
        goalId: string | null;
        planId: string;
        title: string;
        targetDate: Date;
        isCompleted: boolean;
        completedAt: Date | null;
        order: number;
    }>;
    reorderMilestones(planId: string, userId: string, milestones: {
        id: string;
        order: number;
    }[]): Promise<{
        planBudgets: ({
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
        } & {
            planId: string;
            budgetId: string;
        })[];
        planGoals: ({
            goal: {
                name: string;
                status: import("@prisma/client").$Enums.GoalStatus;
                id: string;
                createdAt: Date;
                updatedAt: Date;
                icon: string;
                color: string;
                userId: string;
                targetAmount: import("@prisma/client/runtime/library").Decimal;
                deadline: Date;
                currentAmount: import("@prisma/client/runtime/library").Decimal;
                isLocked: boolean;
                source: import("@prisma/client").$Enums.GoalSource;
                sourceMilestoneId: string | null;
            };
        } & {
            goalId: string;
            planId: string;
        })[];
        milestones: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            description: string | null;
            targetAmount: import("@prisma/client/runtime/library").Decimal | null;
            goalId: string | null;
            planId: string;
            title: string;
            targetDate: Date;
            isCompleted: boolean;
            completedAt: Date | null;
            order: number;
        }[];
    } & {
        name: string;
        status: import("@prisma/client").$Enums.PlanStatus;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        description: string | null;
        endDate: Date;
        startDate: Date;
    }>;
    linkBudget(planId: string, userId: string, budgetId: string): Promise<{
        planId: string;
        budgetId: string;
    }>;
    unlinkBudget(planId: string, userId: string, budgetId: string): Promise<void>;
    linkGoal(planId: string, userId: string, goalId: string): Promise<{
        goalId: string;
        planId: string;
    }>;
    unlinkGoal(planId: string, userId: string, goalId: string): Promise<void>;
}
export declare const planService: PlanService;
//# sourceMappingURL=service.d.ts.map