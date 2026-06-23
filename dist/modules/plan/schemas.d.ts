import { z } from 'zod';
export declare const createPlanSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    startDate: z.ZodDate;
    endDate: z.ZodDate;
    status: z.ZodDefault<z.ZodEnum<["ACTIVE", "COMPLETED", "ARCHIVED"]>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    status: "ACTIVE" | "COMPLETED" | "ARCHIVED";
    endDate: Date;
    startDate: Date;
    description?: string | undefined;
}, {
    name: string;
    endDate: Date;
    startDate: Date;
    status?: "ACTIVE" | "COMPLETED" | "ARCHIVED" | undefined;
    description?: string | undefined;
}>;
export declare const updatePlanSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    startDate: z.ZodOptional<z.ZodDate>;
    endDate: z.ZodOptional<z.ZodDate>;
    status: z.ZodOptional<z.ZodDefault<z.ZodEnum<["ACTIVE", "COMPLETED", "ARCHIVED"]>>>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    status?: "ACTIVE" | "COMPLETED" | "ARCHIVED" | undefined;
    description?: string | undefined;
    endDate?: Date | undefined;
    startDate?: Date | undefined;
}, {
    name?: string | undefined;
    status?: "ACTIVE" | "COMPLETED" | "ARCHIVED" | undefined;
    description?: string | undefined;
    endDate?: Date | undefined;
    startDate?: Date | undefined;
}>;
export declare const planIdSchema: z.ZodObject<{
    id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
}, {
    id: string;
}>;
export declare const createMilestoneSchema: z.ZodObject<{
    title: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    targetDate: z.ZodDate;
    targetAmount: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    title: string;
    targetDate: Date;
    description?: string | undefined;
    targetAmount?: number | undefined;
}, {
    title: string;
    targetDate: Date;
    description?: string | undefined;
    targetAmount?: number | undefined;
}>;
export declare const updateMilestoneSchema: z.ZodObject<{
    title: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    targetDate: z.ZodOptional<z.ZodDate>;
    targetAmount: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    description?: string | undefined;
    targetAmount?: number | undefined;
    title?: string | undefined;
    targetDate?: Date | undefined;
}, {
    description?: string | undefined;
    targetAmount?: number | undefined;
    title?: string | undefined;
    targetDate?: Date | undefined;
}>;
export declare const milestoneIdSchema: z.ZodObject<{
    id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
}, {
    id: string;
}>;
export declare const reorderMilestonesSchema: z.ZodObject<{
    milestones: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        order: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        id: string;
        order: number;
    }, {
        id: string;
        order: number;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    milestones: {
        id: string;
        order: number;
    }[];
}, {
    milestones: {
        id: string;
        order: number;
    }[];
}>;
export type CreatePlanInput = z.infer<typeof createPlanSchema>;
export type UpdatePlanInput = z.infer<typeof updatePlanSchema>;
export type CreateMilestoneInput = z.infer<typeof createMilestoneSchema>;
export type UpdateMilestoneInput = z.infer<typeof updateMilestoneSchema>;
//# sourceMappingURL=schemas.d.ts.map