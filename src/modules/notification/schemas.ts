import { z } from 'zod';

export const createNotificationSchema = z.object({
  title: z.string().min(1, 'Judul wajib diisi'),
  message: z.string().min(1, 'Pesan wajib diisi'),
  type: z.enum(['BUDGET_WARNING', 'GOAL_MILESTONE', 'REMINDER', 'SYSTEM']).default('SYSTEM'),
});

export const updateNotificationSchema = createNotificationSchema.partial();

export const notificationIdSchema = z.object({
  id: z.string().uuid('Invalid UUID format'),
});

export type CreateNotificationInput = z.infer<typeof createNotificationSchema>;
export type UpdateNotificationInput = z.infer<typeof updateNotificationSchema>;
