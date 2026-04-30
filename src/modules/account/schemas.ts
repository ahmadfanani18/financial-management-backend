import { z } from 'zod';

export const createAccountSchema = z.object({
  name: z.string().min(1, 'Nama akun wajib diisi'),
  type: z.enum(['BANK', 'EWALLET', 'CASH', 'CREDIT_CARD', 'INVESTMENT']),
  balance: z.number().default(0),
  currency: z.string().default('IDR'),
  icon: z.string().default('wallet'),
  color: z.string().default('#0EA5E9'),
});

export const updateAccountSchema = createAccountSchema.partial();

export const accountIdSchema = z.object({
  id: z.string().min(1, 'ID wajib diisi'),
});

export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
