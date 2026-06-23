import { z } from 'zod';
export declare const createGoalSchema: z.ZodObject<{
    name: z.ZodString;
    targetAmount: z.ZodNumber;
    deadline: z.ZodDate;
    icon: z.ZodDefault<z.ZodString>;
    color: z.ZodDefault<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    icon: string;
    color: string;
    targetAmount: number;
    deadline: Date;
}, {
    name: string;
    targetAmount: number;
    deadline: Date;
    icon?: string | undefined;
    color?: string | undefined;
}>;
export declare const updateGoalSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    targetAmount: z.ZodOptional<z.ZodNumber>;
    deadline: z.ZodOptional<z.ZodDate>;
    icon: z.ZodOptional<z.ZodDefault<z.ZodString>>;
    color: z.ZodOptional<z.ZodDefault<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    icon?: string | undefined;
    color?: string | undefined;
    targetAmount?: number | undefined;
    deadline?: Date | undefined;
}, {
    name?: string | undefined;
    icon?: string | undefined;
    color?: string | undefined;
    targetAmount?: number | undefined;
    deadline?: Date | undefined;
}>;
export declare const goalIdSchema: z.ZodObject<{
    id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
}, {
    id: string;
}>;
export declare const contributionSchema: z.ZodObject<{
    amount: z.ZodNumber;
    date: z.ZodDate;
    note: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    date: Date;
    amount: number;
    note?: string | undefined;
}, {
    date: Date;
    amount: number;
    note?: string | undefined;
}>;
export declare const contributionWithAccountSchema: z.ZodObject<{
    amount: z.ZodNumber;
    date: z.ZodDate;
    note: z.ZodOptional<z.ZodString>;
    accountId: z.ZodOptional<z.ZodString>;
    categoryId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    date: Date;
    amount: number;
    accountId?: string | undefined;
    categoryId?: string | undefined;
    note?: string | undefined;
}, {
    date: Date;
    amount: number;
    accountId?: string | undefined;
    categoryId?: string | undefined;
    note?: string | undefined;
}>;
export declare const createGoalFromMilestoneSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    targetAmount: z.ZodOptional<z.ZodNumber>;
    deadline: z.ZodOptional<z.ZodString>;
    icon: z.ZodOptional<z.ZodString>;
    color: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    icon?: string | undefined;
    color?: string | undefined;
    targetAmount?: number | undefined;
    deadline?: string | undefined;
}, {
    name?: string | undefined;
    icon?: string | undefined;
    color?: string | undefined;
    targetAmount?: number | undefined;
    deadline?: string | undefined;
}>;
export type CreateGoalInput = z.infer<typeof createGoalSchema>;
export type UpdateGoalInput = z.infer<typeof updateGoalSchema>;
export type ContributionInput = z.infer<typeof contributionSchema>;
export type ContributionWithAccountInput = z.infer<typeof contributionWithAccountSchema>;
export type CreateGoalFromMilestoneInput = z.infer<typeof createGoalFromMilestoneSchema>;
//# sourceMappingURL=schemas.d.ts.map