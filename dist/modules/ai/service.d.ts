import type { GeneratePlanInput, PredictSpendingInput } from './schemas.js';
interface BudgetAllocation {
    category: string;
    percentage: number;
    amount: number;
    type: 'EXPENSE' | 'SAVING';
}
interface SpendingPrediction {
    category: string;
    predictedAmount: number;
    currentAverage: number;
    trend: 'increasing' | 'decreasing' | 'stable';
    confidence: 'high' | 'medium' | 'low';
}
interface SavingSuggestion {
    category: string;
    currentSpending: number;
    suggestedSaving: number;
    reason: string;
}
export declare class AIService {
    generatePlan(userId: string, input: GeneratePlanInput): Promise<{
        summary: {
            monthlyIncome: number;
            needs: number;
            wants: number;
            savings: number;
            currency: string;
        };
        expenses: BudgetAllocation[];
        savings: BudgetAllocation[];
        suggestedGoal: {
            name: string;
            targetAmount: number;
            deadline: Date;
        };
        message: string;
    }>;
    predictSpending(userId: string, input: PredictSpendingInput): Promise<{
        predictions: SpendingPrediction[];
        totalPredicted: number;
        period: string;
        message: string;
        insufficientData: boolean;
    }>;
    suggestSavings(userId: string): Promise<{
        suggestions: SavingSuggestion[];
        currentBalance: number;
        message: string;
    }>;
    generatePlanFromData(userId: string): Promise<{
        error: boolean;
        message: string;
        plan: null;
        summary: null;
    } | {
        error: boolean;
        plan: {
            name: string;
            description: string;
            startDate: string;
            endDate: string;
            status: "ACTIVE";
            milestones: {
                targetDate: string;
                id: string;
                isCompleted: boolean;
                order: number;
                title: string;
                description: string;
                targetAmount: number;
            }[];
        };
        summary: {
            totalBalance: string;
            monthlyIncome: string;
            monthlyExpense: string;
            savings: string;
            topExpenses: {
                category: string;
                amount: number;
            }[];
        };
        message?: undefined;
    }>;
}
export declare const aiService: AIService;
export {};
//# sourceMappingURL=service.d.ts.map