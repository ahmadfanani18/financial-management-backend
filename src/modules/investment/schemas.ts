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

export const sellHoldingSchema = z.object({
  quantity: z.number().int().positive('Jumlah lot harus lebih dari 0'),
  sellPrice: z.number().positive('Harga jual harus lebih dari 0'),
  sellDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD'),
  brokerFee: z.number().int().min(0).default(0),
});

export type CreateHoldingInput = z.infer<typeof createHoldingSchema>;
export type UpdateHoldingInput = z.infer<typeof updateHoldingSchema>;
export type SellHoldingInput = z.infer<typeof sellHoldingSchema>;