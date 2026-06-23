import { prisma } from '../../config/prisma.js';
import { marketPriceService } from '../market-price/service.js';
import type { CreateHoldingInput, UpdateHoldingInput } from './schemas.js';
import type { Holding, MarketPrice } from '@prisma/client';

const LOT_SIZE = 100;

export class InvestmentService {
  async getHoldings(accountId: string, userId: string) {
    const account = await prisma.account.findFirst({
      where: { id: accountId, userId, type: 'INVESTMENT' },
    });

    if (!account) {
      throw new Error('Akun tidak ditemukan');
    }

    const holdings = await prisma.holding.findMany({
      where: { accountId },
      include: { account: true },
    });

    const symbols = holdings.map((h) => h.symbol);
    const marketPrices = await marketPriceService.getBySymbols(symbols);
    const priceMap = new Map(marketPrices.map((p) => [p.symbol, p]));

    const holdingsWithPnL = holdings.map((holding) => {
      const marketPrice = priceMap.get(holding.symbol);
      const assetType = marketPrice?.type || 'CRYPTO';
      const currentPrice = marketPrice ? Number(marketPrice.price) : 0;
      const avgBuyPrice = Number(holding.avgBuyPrice);
      const shares = Number(holding.shares);
      const currentValue = currentPrice * shares;
      const costBasis = avgBuyPrice * shares;
      const pnl = currentValue - costBasis;
      const pnlPercent = costBasis > 0 ? ((currentValue - costBasis) / costBasis) * 100 : 0;

      const displayShares = assetType === 'IDX_STOCK' 
        ? (shares / LOT_SIZE).toString() + ' lot'
        : shares.toString();

      return {
        id: holding.id,
        symbol: holding.symbol,
        name: marketPrice?.name || holding.symbol,
        type: assetType,
        shares: holding.shares,
        sharesDisplay: displayShares,
        avgBuyPrice: holding.avgBuyPrice,
        currentPrice: marketPrice?.price || '0',
        currentValue: currentValue.toString(),
        pnl: pnl.toString(),
        pnlPercent: Math.round(pnlPercent * 100) / 100,
      };
    });

    const totalHoldingsValue = holdingsWithPnL.reduce(
      (sum, h) => sum + Number(h.currentValue),
      0
    );
    const totalPnL = holdingsWithPnL.reduce((sum, h) => sum + Number(h.pnl), 0);
    const totalPortfolioValue = Number(account.balance) + totalHoldingsValue;

    return {
      account: {
        id: account.id,
        name: account.name,
        balance: account.balance,
        type: account.type,
      },
      holdings: holdingsWithPnL,
      totalUninvested: account.balance,
      totalHoldingsValue: totalHoldingsValue.toString(),
      totalPortfolioValue: totalPortfolioValue.toString(),
      totalPnL: totalPnL.toString(),
    };
  }

  async createHolding(userId: string, input: CreateHoldingInput) {
    const account = await prisma.account.findFirst({
      where: { id: input.accountId, userId, type: 'INVESTMENT' },
    });

    if (!account) {
      throw new Error('Akun tidak ditemukan');
    }

    const existing = await prisma.holding.findUnique({
      where: {
        accountId_symbol: {
          accountId: input.accountId,
          symbol: input.symbol,
        },
      },
    });

    if (existing) {
      throw new Error('Aset sudah ada di portfolio. Gunakan Edit untuk update.');
    }

    const marketPrice = await marketPriceService.getBySymbol(input.symbol);
    const assetType = marketPrice?.type || 'CRYPTO';
    const sharesInLembar = Number(input.shares);

    const balance = Number(account.balance);
    if (isNaN(balance)) {
      throw new Error('Balance akun tidak valid. Please contact support.');
    }

    const cost = sharesInLembar * Number(input.avgBuyPrice);

    if (cost > balance) {
      throw new Error(`Saldo tidak cukup. Available: Rp ${balance.toLocaleString('id-ID')}, Required: Rp ${cost.toLocaleString('id-ID')}`);
    }

    const [holding] = await prisma.$transaction([
      prisma.holding.create({
        data: {
          accountId: input.accountId,
          symbol: input.symbol,
          shares: sharesInLembar.toString(),
          avgBuyPrice: input.avgBuyPrice,
        },
      }),
      prisma.account.update({
        where: { id: input.accountId },
        data: { balance: (balance - cost).toString() },
      }),
    ]);

    return holding;
  }

  async updateHolding(id: string, userId: string, input: UpdateHoldingInput) {
    const account = await prisma.account.findFirst({
      where: { id: input.accountId, userId, type: 'INVESTMENT' },
    });

    if (!account) {
      throw new Error('Akun tidak ditemukan');
    }

    const holding = await prisma.holding.findFirst({
      where: { id, accountId: input.accountId },
    });

    if (!holding) {
      throw new Error('Holding tidak ditemukan');
    }

    const marketPrice = await marketPriceService.getBySymbol(holding.symbol);
    const assetType = marketPrice?.type || 'CRYPTO';

    const currentShares = Number(holding.shares);
    const currentAvgBuyPrice = Number(holding.avgBuyPrice);
    const currentCostBasis = currentShares * currentAvgBuyPrice;

    const newSharesInput = input.shares ? Number(input.shares) : null;
    const newSharesInLembar = newSharesInput !== null
      ? newSharesInput
      : currentShares;
    const newAvgBuyPrice = input.avgBuyPrice ? Number(input.avgBuyPrice) : currentAvgBuyPrice;
    const newCostBasis = newSharesInLembar * newAvgBuyPrice;

    const balance = Number(account.balance);
    const costDiff = newCostBasis - currentCostBasis;

    if (costDiff > balance) {
      throw new Error(`Saldo tidak cukup. Available: Rp ${balance.toLocaleString('id-ID')}, Required: Rp ${costDiff.toLocaleString('id-ID')}`);
    }

    await prisma.$transaction([
      prisma.holding.update({
        where: { id },
        data: {
          shares: newSharesInLembar.toString(),
          avgBuyPrice: newAvgBuyPrice.toString(),
        },
      }),
      prisma.account.update({
        where: { id: input.accountId },
        data: { balance: (balance - costDiff).toString() },
      }),
    ]);

    return prisma.holding.findUnique({ where: { id } });
  }

  async deleteHolding(id: string, userId: string) {
    const holding = await prisma.holding.findUnique({
      where: { id },
    });

    if (!holding) {
      throw new Error('Holding tidak ditemukan');
    }

    const account = await prisma.account.findFirst({
      where: { id: holding.accountId, userId },
    });

    if (!account) {
      throw new Error('Akun tidak ditemukan');
    }

    const currentBalance = Number(account.balance);
    if (isNaN(currentBalance)) {
      throw new Error('Balance akun tidak valid. Please contact support.');
    }

    const marketPrice = await marketPriceService.getBySymbol(holding.symbol);
    const currentPrice = marketPrice ? Number(marketPrice.price) : 0;
    const shares = Number(holding.shares);
    const proceeds = currentPrice * shares;

    await prisma.$transaction([
      prisma.holding.delete({ where: { id } }),
      prisma.account.update({
        where: { id: holding.accountId },
        data: { balance: (currentBalance + proceeds).toString() },
      }),
    ]);
  }
}

export const investmentService = new InvestmentService();