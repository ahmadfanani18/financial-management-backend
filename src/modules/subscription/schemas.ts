import { z } from '@/shared/zod.js';

export const activateTrialSchema = z.object({});

export type ActivateTrialInput = z.infer<typeof activateTrialSchema>;