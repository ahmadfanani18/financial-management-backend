import { z } from 'zod';

export const reportQuerySchema = z.object({
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  accountId: z.string().optional(),
});

export const monthlyReportSchema = z.object({
  year: z.coerce.number().int(),
  month: z.coerce.number().int().min(1).max(12),
});

export const trendsSchema = z.object({
  months: z.coerce.number().int().min(1).max(12).default(6),
});

export type ReportQuery = z.infer<typeof reportQuerySchema>;
export type MonthlyReportInput = z.infer<typeof monthlyReportSchema>;
export type TrendsInput = z.infer<typeof trendsSchema>;
