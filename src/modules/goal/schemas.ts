import { z } from 'zod';

export const createGoalSchema = z.object({
  name: z.string().min(1, 'Nama target wajib diisi'),
  targetAmount: z.number().positive('Target jumlah harus positif'),
  deadline: z.coerce.date(),
  icon: z.string().default('target'),
  color: z.string().default('#10B981'),
  createBudget: z.boolean().optional(),
  monthlyAmount: z.number().optional(),
});

export const updateGoalSchema = createGoalSchema.partial();

export const goalIdSchema = z.object({
  id: z.string().uuid('Invalid UUID format'),
});

export const milestoneIdSchema = z.object({
  milestoneId: z.string().uuid('Invalid UUID format'),
});

export const contributionSchema = z.object({
  amount: z.number().positive('Jumlah kontribusi harus positif'),
  date: z.coerce.date(),
  note: z.string().optional(),
});

export const contributionWithAccountSchema = z.object({
  amount: z.number().positive('Jumlah kontribusi harus positif'),
  date: z.coerce.date(),
  note: z.string().optional(),
  accountId: z.string().optional(),
  categoryId: z.string().optional(),
});

export const createGoalFromMilestoneSchema = z.object({
  name: z.string().min(1).optional(),
  targetAmount: z.number().positive().optional(),
  deadline: z.string().optional(),
  icon: z.string().optional(),
  color: z.string().optional(),
});

export type CreateGoalInput = z.infer<typeof createGoalSchema>;
export type UpdateGoalInput = z.infer<typeof updateGoalSchema>;
export type ContributionInput = z.infer<typeof contributionSchema>;
export type ContributionWithAccountInput = z.infer<typeof contributionWithAccountSchema>;
export type CreateGoalFromMilestoneInput = z.infer<typeof createGoalFromMilestoneSchema>;
