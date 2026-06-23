import { z } from 'zod';
export declare const createCategorySchema: z.ZodObject<{
    name: z.ZodString;
    type: z.ZodEnum<["INCOME", "EXPENSE"]>;
    icon: z.ZodDefault<z.ZodString>;
    color: z.ZodDefault<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    type: "INCOME" | "EXPENSE";
    icon: string;
    color: string;
}, {
    name: string;
    type: "INCOME" | "EXPENSE";
    icon?: string | undefined;
    color?: string | undefined;
}>;
export declare const updateCategorySchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    type: z.ZodOptional<z.ZodEnum<["INCOME", "EXPENSE"]>>;
    icon: z.ZodOptional<z.ZodDefault<z.ZodString>>;
    color: z.ZodOptional<z.ZodDefault<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    type?: "INCOME" | "EXPENSE" | undefined;
    icon?: string | undefined;
    color?: string | undefined;
}, {
    name?: string | undefined;
    type?: "INCOME" | "EXPENSE" | undefined;
    icon?: string | undefined;
    color?: string | undefined;
}>;
export declare const categoryIdSchema: z.ZodObject<{
    id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
}, {
    id: string;
}>;
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
//# sourceMappingURL=schemas.d.ts.map