import { z } from 'zod';

export const analyzeReceiptRequestSchema = z.object({
  image: z.string().min(1, 'Gambar tidak ditemukan'),
});

export const extractedItemSchema = z.object({
  name: z.string(),
  price: z.number(),
});

export const analyzeReceiptResponseSchema = z.object({
  items: z.array(extractedItemSchema),
  total: z.number(),
  rawText: z.string().optional(),
});

export type AnalyzeReceiptRequest = z.infer<typeof analyzeReceiptRequestSchema>;
export type AnalyzeReceiptResponse = z.infer<typeof analyzeReceiptResponseSchema>;
