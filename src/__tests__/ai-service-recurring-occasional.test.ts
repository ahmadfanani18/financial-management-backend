import { describe, it, expect } from 'vitest';
import { getUniqueMonths, classifyExpenseFrequency } from '../modules/ai/service.js';

describe('getUniqueMonths', () => {
  it('returns 1 for transactions in same month', () => {
    const txns = [
      { date: new Date('2026-06-01') },
      { date: new Date('2026-06-15') },
      { date: new Date('2026-06-28') },
    ];
    expect(getUniqueMonths(txns)).toBe(1);
  });

  it('returns 3 for transactions across 3 months', () => {
    const txns = [
      { date: new Date('2026-04-01') },
      { date: new Date('2026-05-15') },
      { date: new Date('2026-06-28') },
    ];
    expect(getUniqueMonths(txns)).toBe(3);
  });

  it('handles year boundary', () => {
    const txns = [
      { date: new Date('2026-11-01') },
      { date: new Date('2026-12-15') },
      { date: new Date('2027-01-28') },
    ];
    expect(getUniqueMonths(txns)).toBe(3);
  });
});

describe('classifyExpenseFrequency', () => {
  it('returns occasional for 0 transactions', () => {
    const result = classifyExpenseFrequency([], 3);
    expect(result).toBe('occasional');
  });

  it('returns recurring for <3 months of data', () => {
    const txns = [{ date: new Date('2026-06-01') }];
    const result = classifyExpenseFrequency(txns, 3);
    expect(result).toBe('recurring');
  });

  it('returns recurring when <3 months data (user baru)', () => {
    const txns = [
      { date: new Date('2026-06-01') },
      { date: new Date('2026-06-15') },
    ];
    const result = classifyExpenseFrequency(txns, 3);
    expect(result).toBe('recurring');
  });

  it('returns recurring when 2 months have transactions out of 3', () => {
    const txns = [
      { date: new Date('2026-05-01') },
      { date: new Date('2026-05-15') },
      { date: new Date('2026-06-01') },
    ];
    const result = classifyExpenseFrequency(txns, 3);
    expect(result).toBe('recurring');
  });

  it('returns recurring when all 3 months have transactions', () => {
    const txns = [
      { date: new Date('2026-04-01') },
      { date: new Date('2026-05-01') },
      { date: new Date('2026-06-01') },
    ];
    const result = classifyExpenseFrequency(txns, 3);
    expect(result).toBe('recurring');
  });
});
