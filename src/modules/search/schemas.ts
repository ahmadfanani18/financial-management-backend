import { z } from 'zod';

export const searchQuerySchema = z.object({
  q: z.string().min(1).max(100),
  limit: z.preprocess((val) => (val ? parseInt(val as string, 10) : 5), z.number().min(1).max(10).default(5)),
});

export type SearchQuery = z.infer<typeof searchQuerySchema>;

export interface SearchResult {
  transactions: Array<{
    id: string;
    description: string;
    date: Date;
    amount: number;
  }>;
  accounts: Array<{
    id: string;
    name: string;
    type: string;
  }>;
  categories: Array<{
    id: string;
    name: string;
    type: 'INCOME' | 'EXPENSE';
  }>;
  budgets: Array<{
    id: string;
    categoryName: string;
    amount: number;
  }>;
  goals: Array<{
    id: string;
    name: string;
    targetAmount: number;
    currentAmount: number;
  }>;
  plans: Array<{
    id: string;
    name: string;
    status: 'ACTIVE' | 'COMPLETED' | 'ARCHIVED';
  }>;
  total: number;
}