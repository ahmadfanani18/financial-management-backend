import { z } from 'zod';
export declare const createBudgetSchema: z.ZodObject<{
    categoryId: z.ZodString;
    amount: z.ZodNumber;
    period: z.ZodDefault<z.ZodEnum<["MONTHLY", "WEEKLY", "YEARLY", "CUSTOM"]>>;
    startDate: z.ZodDate;
    endDate: z.ZodOptional<z.ZodDate>;
    warningThreshold: z.ZodDefault<z.ZodNumber>;
    isActive: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    categoryId: string;
    amount: number;
    startDate: Date;
    period: "WEEKLY" | "MONTHLY" | "YEARLY" | "CUSTOM";
    warningThreshold: number;
    isActive: boolean;
    endDate?: Date | undefined;
}, {
    categoryId: string;
    amount: number;
    startDate: Date;
    endDate?: Date | undefined;
    period?: "WEEKLY" | "MONTHLY" | "YEARLY" | "CUSTOM" | undefined;
    warningThreshold?: number | undefined;
    isActive?: boolean | undefined;
}>;
export declare const updateBudgetSchema: z.ZodObject<{
    categoryId: z.ZodOptional<z.ZodString>;
    amount: z.ZodOptional<z.ZodNumber>;
    period: z.ZodOptional<z.ZodDefault<z.ZodEnum<["MONTHLY", "WEEKLY", "YEARLY", "CUSTOM"]>>>;
    startDate: z.ZodOptional<z.ZodDate>;
    endDate: z.ZodOptional<z.ZodOptional<z.ZodDate>>;
    warningThreshold: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    isActive: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
}, "strip", z.ZodTypeAny, {
    categoryId?: string | undefined;
    amount?: number | undefined;
    endDate?: Date | undefined;
    startDate?: Date | undefined;
    period?: "WEEKLY" | "MONTHLY" | "YEARLY" | "CUSTOM" | undefined;
    warningThreshold?: number | undefined;
    isActive?: boolean | undefined;
}, {
    categoryId?: string | undefined;
    amount?: number | undefined;
    endDate?: Date | undefined;
    startDate?: Date | undefined;
    period?: "WEEKLY" | "MONTHLY" | "YEARLY" | "CUSTOM" | undefined;
    warningThreshold?: number | undefined;
    isActive?: boolean | undefined;
}>;
export declare const budgetIdSchema: z.ZodObject<{
    id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
}, {
    id: string;
}>;
export type CreateBudgetInput = z.infer<typeof createBudgetSchema>;
export type UpdateBudgetInput = z.infer<typeof updateBudgetSchema>;
//# sourceMappingURL=schemas.d.ts.map