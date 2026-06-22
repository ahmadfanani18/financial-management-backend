import { z } from 'zod';

export const getHoldingsSchema = z.object({
  accountId: z.string().min(1, 'Account ID wajib diisi'),
});

export const createHoldingSchema = z.object({
  accountId: z.string().min(1, 'Account ID wajib diisi'),
  symbol: z.string().min(1, 'Symbol wajib diisi'),
  shares: z.string().min(1, 'Jumlah unit wajib diisi'),
  avgBuyPrice: z.string().min(1, 'Harga rata-rata wajib diisi'),
});

export const updateHoldingSchema = z.object({
  accountId: z.string().min(1, 'Account ID wajib diisi'),
  shares: z.string().optional(),
  avgBuyPrice: z.string().optional(),
});

export const holdingIdSchema = z.object({
  id: z.string().min(1, 'ID wajib diisi'),
});

export type CreateHoldingInput = z.infer<typeof createHoldingSchema>;
export type UpdateHoldingInput = z.infer<typeof updateHoldingSchema>;