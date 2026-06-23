import { z } from 'zod';
export declare const createNotificationSchema: z.ZodObject<{
    title: z.ZodString;
    message: z.ZodString;
    type: z.ZodDefault<z.ZodEnum<["BUDGET_WARNING", "GOAL_MILESTONE", "REMINDER", "SYSTEM"]>>;
}, "strip", z.ZodTypeAny, {
    message: string;
    type: "BUDGET_WARNING" | "GOAL_MILESTONE" | "REMINDER" | "SYSTEM";
    title: string;
}, {
    message: string;
    title: string;
    type?: "BUDGET_WARNING" | "GOAL_MILESTONE" | "REMINDER" | "SYSTEM" | undefined;
}>;
export declare const updateNotificationSchema: z.ZodObject<{
    title: z.ZodOptional<z.ZodString>;
    message: z.ZodOptional<z.ZodString>;
    type: z.ZodOptional<z.ZodDefault<z.ZodEnum<["BUDGET_WARNING", "GOAL_MILESTONE", "REMINDER", "SYSTEM"]>>>;
}, "strip", z.ZodTypeAny, {
    message?: string | undefined;
    type?: "BUDGET_WARNING" | "GOAL_MILESTONE" | "REMINDER" | "SYSTEM" | undefined;
    title?: string | undefined;
}, {
    message?: string | undefined;
    type?: "BUDGET_WARNING" | "GOAL_MILESTONE" | "REMINDER" | "SYSTEM" | undefined;
    title?: string | undefined;
}>;
export declare const notificationIdSchema: z.ZodObject<{
    id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
}, {
    id: string;
}>;
export type CreateNotificationInput = z.infer<typeof createNotificationSchema>;
export type UpdateNotificationInput = z.infer<typeof updateNotificationSchema>;
//# sourceMappingURL=schemas.d.ts.map