import { z } from 'zod';
export declare const generatePlanSchema: z.ZodObject<{
    monthlyIncome: z.ZodNumber;
    currency: z.ZodDefault<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    currency: string;
    monthlyIncome: number;
}, {
    monthlyIncome: number;
    currency?: string | undefined;
}>;
export declare const predictSpendingSchema: z.ZodObject<{
    months: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    months: number;
}, {
    months?: number | undefined;
}>;
export declare const generatePlanFromDataSchema: z.ZodObject<{}, "strip", z.ZodTypeAny, {}, {}>;
export type GeneratePlanInput = z.infer<typeof generatePlanSchema>;
export type PredictSpendingInput = z.infer<typeof predictSpendingSchema>;
export type GeneratePlanFromDataInput = z.infer<typeof generatePlanFromDataSchema>;
//# sourceMappingURL=schemas.d.ts.map