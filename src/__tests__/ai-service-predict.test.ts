import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '../../config/prisma.js';

vi.mock('../../config/prisma.js', () => ({
  prisma: {
    transaction: { findMany: vi.fn() },
    budget: { findMany: vi.fn() },
    account: { findMany: vi.fn() },
  },
}));

import { weightedAverage, calculateTimeSpanMonths, calculateConfidenceScore, categorizeByDataPoints } from '../modules/ai/service.js';

describe('Prediction Helper Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('weightedAverage', () => {
    it('should calculate weighted average correctly', () => {
      const amounts = [100000, 150000, 200000, 250000];
      const result = weightedAverage(amounts);
      expect(result).toBe(200000);
    });

    it('should return 0 for empty array', () => {
      expect(weightedAverage([])).toBe(0);
    });
  });

  describe('calculateTimeSpanMonths', () => {
    it('should return 1 for single transaction', () => {
      const txns = [{ date: new Date('2026-06-15') }];
      expect(calculateTimeSpanMonths(txns)).toBe(1);
    });

    it('should calculate span across months correctly', () => {
      const txns = [
        { date: new Date('2026-04-10') },
        { date: new Date('2026-06-20') },
      ];
      expect(calculateTimeSpanMonths(txns)).toBe(3);
    });
  });

  describe('calculateConfidenceScore', () => {
    it('should return low for score < 5', () => {
      expect(calculateConfidenceScore(3, 1, 3)).toBe('low');
    });

    it('should return medium for score >= 5 and <= 15', () => {
      expect(calculateConfidenceScore(10, 3, 3)).toBe('medium');
    });

    it('should return high for score > 15', () => {
      expect(calculateConfidenceScore(30, 3, 3)).toBe('high');
    });
  });

  describe('categorizeByDataPoints', () => {
    it('should handle 0 data points', () => {
      const result = categorizeByDataPoints([], []);
      expect(result.calculationMethod).toBe('no_spending');
      expect(result.predictedAmount).toBe(0);
    });

    it('should handle 1 data point', () => {
      const result = categorizeByDataPoints([500000], [{ date: new Date(), amount: 500000 }]);
      expect(result.calculationMethod).toBe('single_transaction');
      expect(result.predictedAmount).toBe(500000);
    });

    it('should handle 2-3 data points with weighted average', () => {
      const amounts = [100000, 200000, 300000];
      const txns = amounts.map((a, i) => ({ date: new Date(2026, i, 15), amount: a }));
      const result = categorizeByDataPoints(amounts, txns);
      expect(result.calculationMethod).toBe('weighted_average');
      expect(result.predictedAmount).toBeGreaterThan(0);
    });

    it('should handle 4+ data points with trend projection', () => {
      const txns = [
        { date: new Date('2026-01-01'), amount: 100000 },
        { date: new Date('2026-02-01'), amount: 110000 },
        { date: new Date('2026-03-01'), amount: 125000 },
        { date: new Date('2026-04-01'), amount: 145000 },
        { date: new Date('2026-05-01'), amount: 170000 },
      ];
      const amounts = txns.map(t => t.amount);
      const result = categorizeByDataPoints(amounts, txns);
      expect(result.calculationMethod).toBe('trend_projection');
      expect(['increasing', 'stable', 'decreasing']).toContain(result.trend);
    });
  });
});