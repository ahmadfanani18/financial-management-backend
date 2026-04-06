import { z } from 'zod';

export const createPlanSchema = z.object({
  name: z.string().min(1, 'Nama rencana wajib diisi'),
  description: z.string().optional(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  status: z.enum(['ACTIVE', 'COMPLETED', 'ARCHIVED']).default('ACTIVE'),
});

export const updatePlanSchema = createPlanSchema.partial();

export const planIdSchema = z.object({
  id: z.string().uuid('Invalid UUID format'),
});

export const createMilestoneSchema = z.object({
  title: z.string().min(1, 'Judul milestone wajib diisi'),
  description: z.string().optional(),
  targetDate: z.coerce.date(),
  targetAmount: z.number().optional(),
});

export const updateMilestoneSchema = createMilestoneSchema.partial();

export const milestoneIdSchema = z.object({
  id: z.string().uuid('Invalid UUID format'),
});

export const reorderMilestonesSchema = z.object({
  milestones: z.array(z.object({
    id: z.string().uuid(),
    order: z.number().int(),
  })),
});

export type CreatePlanInput = z.infer<typeof createPlanSchema>;
export type UpdatePlanInput = z.infer<typeof updatePlanSchema>;
export type CreateMilestoneInput = z.infer<typeof createMilestoneSchema>;
export type UpdateMilestoneInput = z.infer<typeof updateMilestoneSchema>;
