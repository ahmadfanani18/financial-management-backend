import { z } from 'zod';

export const createTransactionSchema = z.object({
  accountId: z.string().min(1, 'Akun wajib dipilih'),
  categoryId: z.string().optional(),
  type: z.enum(['INCOME', 'EXPENSE', 'TRANSFER']),
  amount: z.number().positive('Jumlah harus positif'),
  adminFee: z.number().min(0, 'Biaya admin tidak boleh negatif').optional(),
  description: z.string().default(''),
  note: z.string().optional(),
  date: z.coerce.date(),
  receiptUrl: z.string().url().optional(),
  fromAccountId: z.string().optional(),
  toAccountId: z.string().optional(),
  isRecurring: z.boolean().default(false),
  recurringPattern: z.object({
    frequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']),
    interval: z.number().positive(),
    endDate: z.date().optional(),
  }).optional(),
  tagIds: z.array(z.string()).optional(),
  deductGoals: z.boolean().default(false),
});

export const updateTransactionSchema = createTransactionSchema.partial();

export const createTransactionSchemaWithFee = createTransactionSchema.refine(
  (data) => {
    if (data.type !== 'TRANSFER') return true;
    if (data.adminFee === undefined) return true;
    return data.adminFee <= data.amount;
  },
  { message: 'Biaya admin tidak boleh lebih besar dari jumlah transfer', path: ['adminFee'] }
);

export const transactionIdSchema = z.object({
  id: z.string().uuid('Invalid UUID format'),
});

export const transactionQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  accountId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  type: z.enum(['INCOME', 'EXPENSE', 'TRANSFER']).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  minAmount: z.coerce.number().optional(),
  maxAmount: z.coerce.number().optional(),
  search: z.string().optional(),
});

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;
export type TransactionQuery = z.infer<typeof transactionQuerySchema>;

export const importCsvRowSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format: YYYY-MM-DD'),
  description: z.string().min(1, 'Deskripsi wajib diisi').max(255),
  category: z.string().min(1, 'Kategori wajib dipilih'),
  account: z.string().min(1, 'Akun wajib dipilih'),
  amount: z.number().positive('Jumlah harus positif'),
});

export const importPreviewResponseSchema = z.object({
  validRows: z.array(importCsvRowSchema),
  errorRows: z.array(z.object({
    row: z.number(),
    data: z.record(z.any()),
    error: z.string(),
  })),
  summary: z.object({
    valid: z.number(),
    errors: z.number(),
    total: z.number(),
  }),
});

export const importConfirmRequestSchema = z.object({
  transactions: z.array(z.object({
    date: z.string(),
    description: z.string(),
    categoryId: z.string().optional(),
    accountId: z.string().optional(),
    fromAccountId: z.string().optional(),
    toAccountId: z.string().optional(),
    amount: z.number(),
    adminFee: z.number().optional(),
    type: z.enum(['INCOME', 'EXPENSE', 'TRANSFER']),
  })),
});

export const importConfirmResponseSchema = z.object({
  imported: z.number(),
  failed: z.number(),
  errors: z.array(z.string()),
});

export type ImportPreviewResponse = z.infer<typeof importPreviewResponseSchema>;
export type ImportConfirmRequest = z.infer<typeof importConfirmRequestSchema>;
export type ImportConfirmResponse = z.infer<typeof importConfirmResponseSchema>;
