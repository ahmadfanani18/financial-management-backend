import { z } from 'zod';
export declare const reportQuerySchema: z.ZodObject<{
    startDate: z.ZodDate;
    endDate: z.ZodDate;
    accountId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    endDate: Date;
    startDate: Date;
    accountId?: string | undefined;
}, {
    endDate: Date;
    startDate: Date;
    accountId?: string | undefined;
}>;
export declare const monthlyReportSchema: z.ZodObject<{
    year: z.ZodNumber;
    month: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    month: number;
    year: number;
}, {
    month: number;
    year: number;
}>;
export declare const trendsSchema: z.ZodObject<{
    months: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    months: number;
}, {
    months?: number | undefined;
}>;
export type ReportQuery = z.infer<typeof reportQuerySchema>;
export type MonthlyReportInput = z.infer<typeof monthlyReportSchema>;
export type TrendsInput = z.infer<typeof trendsSchema>;
//# sourceMappingURL=schemas.d.ts.map