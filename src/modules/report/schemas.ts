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

export const mutationsQuerySchema = z.object({
  accountId: z.string().uuid('Invalid account ID'),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
}).refine(data => data.startDate <= data.endDate, {
  message: 'startDate tidak boleh lebih besar dari endDate',
  path: ['startDate'],
}).refine(data => {
  const diffDays = Math.ceil((data.endDate.getTime() - data.startDate.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays <= 365;
}, {
  message: 'Rentang tanggal maksimal 365 hari',
  path: ['endDate'],
});

export type ReportQuery = z.infer<typeof reportQuerySchema>;
export type MonthlyReportInput = z.infer<typeof monthlyReportSchema>;
export type TrendsInput = z.infer<typeof trendsSchema>;
export type MutationsQuery = z.infer<typeof mutationsQuerySchema>;
