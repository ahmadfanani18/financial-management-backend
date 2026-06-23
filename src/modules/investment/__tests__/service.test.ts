import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../../config/prisma.js', () => ({
  prisma: {
    holding: {
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    investmentTransaction: {
      create: vi.fn(),
    },
    account: {
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import { InvestmentService } from '../service';
import { prisma } from '../../../config/prisma.js';

describe('InvestmentService.sellHolding', () => {
  let service: InvestmentService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new InvestmentService();
  });

  it('should throw 404 if holding not found', async () => {
    prisma.holding.findUnique.mockResolvedValue(null);

    await expect(
      service.sellHolding('holding-123', {
        quantity: 1,
        sellPrice: 9800,
        sellDate: '2026-06-23',
        brokerFee: 0,
      })
    ).rejects.toThrow('Posisi tidak ditemukan');
  });

  it('should throw 400 if selling more than owned', async () => {
    prisma.holding.findUnique.mockResolvedValue({
      id: 'holding-123',
      symbol: 'BBCA',
      shares: '10000',
      avgBuyPrice: '5000',
      realizedPnL: '0',
      account: { id: 'acc-1', type: 'INVESTMENT', balance: '1000000' },
    });

    await expect(
      service.sellHolding('holding-123', {
        quantity: 101,
        sellPrice: 9800,
        sellDate: '2026-06-23',
        brokerFee: 0,
      })
    ).rejects.toThrow('Jumlah lot melebihi posisi yang dimiliki');
  });

  it('should calculate P&L correctly for partial sell', async () => {
    const holding = {
      id: 'holding-123',
      symbol: 'BBCA',
      shares: '20000',
      avgBuyPrice: '5000',
      realizedPnL: '0',
      account: { id: 'acc-1', type: 'INVESTMENT', balance: '1000000' },
    };

    prisma.holding.findUnique.mockResolvedValue(holding);
    prisma.$transaction.mockImplementation(async (cb) => {
      const tx = {
        investmentTransaction: { create: vi.fn().mockResolvedValue({ id: 'tx-1' }) },
        holding: { 
          update: vi.fn().mockResolvedValue({ ...holding, shares: '19900' }),
          delete: vi.fn(),
        },
        account: { update: vi.fn().mockResolvedValue({ ...holding.account, balance: '1096500' }) },
      };
      return cb(tx);
    });

    const result = await service.sellHolding('holding-123', {
      quantity: 1,
      sellPrice: 9800,
      sellDate: '2026-06-23',
      brokerFee: 15000,
    });

    expect(result.remainingQuantity).toBe(19900);
    expect(result.grossProceeds).toBe(980000);
    expect(result.netProceeds).toBe(965000);
    expect(result.realizedPnL).toBe(465000);
  });

  it('should delete holding on full sell', async () => {
    const holding = {
      id: 'holding-123',
      symbol: 'BBCA',
      shares: '10000',
      avgBuyPrice: '5000',
      realizedPnL: '0',
      account: { id: 'acc-1', type: 'INVESTMENT', balance: '1000000' },
    };

    prisma.holding.findUnique.mockResolvedValue(holding);
    prisma.$transaction.mockImplementation(async (cb) => {
      const tx = {
        investmentTransaction: { create: vi.fn().mockResolvedValue({ id: 'tx-1' }) },
        holding: { 
          update: vi.fn().mockResolvedValue({ ...holding, shares: '0' }),
          delete: vi.fn().mockResolvedValue(holding),
        },
        account: { update: vi.fn().mockResolvedValue({ ...holding.account, balance: '1965000' }) },
      };
      return cb(tx);
    });

    const result = await service.sellHolding('holding-123', {
      quantity: 100,
      sellPrice: 9800,
      sellDate: '2026-06-23',
      brokerFee: 15000,
    });

    expect(result.remainingQuantity).toBe(0);
  });
});
