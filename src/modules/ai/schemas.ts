import { z } from 'zod';

export const generatePlanSchema = z.object({
  monthlyIncome: z.number().positive('Income harus positif'),
  currency: z.string().default('IDR'),
});

export const predictSpendingSchema = z.object({
  months: z.number().int().min(1).max(12).default(3),
});

export const generatePlanFromDataSchema = z.object({});

export type GeneratePlanInput = z.infer<typeof generatePlanSchema>;
export type PredictSpendingInput = z.infer<typeof predictSpendingSchema>;
export type GeneratePlanFromDataInput = z.infer<typeof generatePlanFromDataSchema>;
