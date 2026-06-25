import { z } from 'zod';

export const feedbackTypeEnum = z.enum(['BUG', 'SUGGESTION']);
export const feedbackStatusEnum = z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED']);

export const createFeedbackSchema = z.object({
  type: feedbackTypeEnum,
  subject: z.string().min(3).max(200),
  description: z.string().min(10).max(5000),
  screenshot: z.string().optional(),
});

export const updateFeedbackStatusSchema = z.object({
  status: feedbackStatusEnum.optional(),
  adminNote: z.string().max(1000).optional(),
});

export type CreateFeedbackInput = z.infer<typeof createFeedbackSchema>;
export type UpdateFeedbackStatusInput = z.infer<typeof updateFeedbackStatusSchema>;
