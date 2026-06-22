import { z } from 'zod';

export const symbolsQuerySchema = z.object({
  symbols: z.string().optional(),
});

export const searchQuerySchema = z.object({
  query: z.string().min(1),
  type: z.enum(['CRYPTO', 'US_STOCK', 'IDX_STOCK']).optional(),
});
