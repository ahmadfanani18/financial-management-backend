import { z } from 'zod';

export const createBudgetSchema = z.object({
  categoryId: z.string().uuid('Invalid category ID'),
  amount: z.number().positive('Jumlah anggaran harus positif'),
  period: z.enum(['MONTHLY', 'WEEKLY', 'YEARLY', 'CUSTOM']).default('MONTHLY'),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional(),
  warningThreshold: z.number().int().min(0).max(100).default(80),
  isActive: z.boolean().default(true),
});

export const updateBudgetSchema = createBudgetSchema.partial();

export const budgetIdSchema = z.object({
  id: z.string().uuid('Invalid UUID format'),
});

export type CreateBudgetInput = z.infer<typeof createBudgetSchema>;
export type UpdateBudgetInput = z.infer<typeof updateBudgetSchema>;
