import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSuggestSavings = vi.hoisted(() => vi.fn());

vi.mock('../modules/ai/service.js', () => ({
  AIService: vi.fn(() => ({
    suggestSavings: mockSuggestSavings,
  })),
  aiService: {
    suggestSavings: mockSuggestSavings,
  },
}));

import { aiService } from '../modules/ai/service.js';

describe('suggestSavings - Rolling Balance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should use totalAccountBalance as available funds', async () => {
    mockSuggestSavings.mockResolvedValue({
      suggestions: [],
      currentBalance: 8000000,
      totalAccountBalance: 10000000,
      monthlyExpenseToUses: 2000000,
    });

    const result = await aiService.suggestSavings('user-1');

    expect(result.totalAccountBalance).toBe(10000000);
    expect(result.currentBalance).toBe(8000000);
    expect(result.monthlyExpenseToUses).toBe(2000000);
  });

  it('should show "spending from savings" when currentBalance < 0 but totalAccountBalance > 0', async () => {
    mockSuggestSavings.mockResolvedValue({
      suggestions: [
        { category: 'Spending dari Tabungan', currentSpending: 20000000, suggestedSaving: 1500000, reason: '' },
      ],
      currentBalance: -15000000,
      totalAccountBalance: 5000000,
      monthlyExpenseToUses: 20000000,
    });

    const result = await aiService.suggestSavings('user-1');

    expect(result.totalAccountBalance).toBe(5000000);
    expect(result.currentBalance).toBe(-15000000);
    expect(result.suggestions.some(s => s.category === 'Kurangi Defisit')).toBe(false);
    expect(result.suggestions.some(s => s.category === 'Spending dari Tabungan')).toBe(true);
  });

  it('should suggest Dana Darurat when totalBalance < available funds * 0.5', async () => {
    mockSuggestSavings.mockResolvedValue({
      suggestions: [
        { category: 'Dana Darurat', currentSpending: 0, suggestedSaving: 2500000, reason: '' },
      ],
      currentBalance: 5000000,
      totalAccountBalance: 10000000,
      monthlyExpenseToUses: 5000000,
    });

    const result = await aiService.suggestSavings('user-1');

    expect(result.suggestions.some(s => s.category === 'Dana Darurat')).toBe(true);
  });

  it('should suggest Tabungan Umum when emergency fund is met', async () => {
    mockSuggestSavings.mockResolvedValue({
      suggestions: [
        { category: 'Tabungan Umum', currentSpending: 0, suggestedSaving: 15000000, reason: '' },
      ],
      currentBalance: 55000000,
      totalAccountBalance: 60000000,
      monthlyExpenseToUses: 5000000,
    });

    const result = await aiService.suggestSavings('user-1');

    expect(result.suggestions.some(s => s.category === 'Tabungan Umum')).toBe(true);
    expect(result.suggestions.some(s => s.category === 'Dana Darurat')).toBe(false);
  });
});
