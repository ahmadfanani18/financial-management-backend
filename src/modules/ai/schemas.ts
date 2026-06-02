import { z } from 'zod';

export const generatePlanSchema = z.object({
  monthlyIncome: z.number().positive(),
  currency: z.string().default('IDR'),
  dependents: z.number().int().min(0).default(0),
});

export const predictSpendingSchema = z.object({
  months: z.number().int().min(1).max(12).default(3),
});

export const generatePlanFromDataSchema = z.object({});

export const smartSaverCalculateSchema = z.object({
  itemName: z.string().optional(),
  targetPrice: z.number().positive(),
  monthlyBudget: z.number().positive().optional(),
});

export type SmartSaverCalculateInput = z.infer<typeof smartSaverCalculateSchema>;

export type GeneratePlanInput = z.infer<typeof generatePlanSchema>;
export type PredictSpendingInput = z.infer<typeof predictSpendingSchema>;
export type GeneratePlanFromDataInput = z.infer<typeof generatePlanFromDataSchema>;

export interface SmartSaverResult {
  progress: number;
  remainingNeeded: number;
  monthlyNeeded: number;
  estimatedMonths: number;
  startDate: string;
  targetDate: string;
  feasibility: 'safe' | 'tight' | 'aggressive';
  insight: string;
  suggestion?: {
    monthlyBudget: number;
    reason: string;
  };
}

export interface SmartSaverSuggestion {
  name: string;
  category: string;
  estimatedPrice: number;
  estimatedMonths: number;
  merchant: string;
  lastTransactionDate: string;
}
