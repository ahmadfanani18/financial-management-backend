import { z } from 'zod';

export const createBillSchema = z.object({
  name: z.string().min(1).max(100),
  amount: z.string().min(1),
  amountType: z.enum(['FIXED', 'VARIABLE']).default('FIXED'),
  mode: z.enum(['AUTO_DEDUCT', 'REMINDER_ONLY']).default('AUTO_DEDUCT'),
  dueDate: z.number().int().min(1).max(31),
  executionDate: z.number().int().min(1).max(31),
  accountId: z.string().uuid(),
  categoryId: z.string().uuid(),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
});

export const updateBillSchema = createBillSchema.partial();

export const updateBillAmountSchema = z.object({
  amount: z.string().min(1),
});

export const markPaidSchema = z.object({
  amount: z.string().optional(),
  createTransaction: z.boolean().optional().default(true),
});

export const billIdSchema = z.object({
  id: z.string().uuid(),
});

export type CreateBillInput = z.infer<typeof createBillSchema>;
export type UpdateBillInput = z.infer<typeof updateBillSchema>;
export type UpdateBillAmountInput = z.infer<typeof updateBillAmountSchema>;
export type MarkPaidInput = z.infer<typeof markPaidSchema>;
