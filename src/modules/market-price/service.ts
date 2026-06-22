import { prisma } from '../../config/prisma.js';
import { fetchYahooFinanceBatch, fetchUsdIdrRate } from './yahoo-finance.js';
import type { AssetType } from '@prisma/client';

const ASSET_LIST = {
  CRYPTO: [
    { symbol: 'BTC', name: 'Bitcoin' },
    { symbol: 'ETH', name: 'Ethereum' },
    { symbol: 'SOL', name: 'Solana' },
    { symbol: 'BNB', name: 'Binance Coin' },
    { symbol: 'XRP', name: 'Ripple' },
    { symbol: 'ADA', name: 'Cardano' },
    { symbol: 'DOGE', name: 'Dogecoin' },
    { symbol: 'DOT', name: 'Polkadot' },
    { symbol: 'MATIC', name: 'Polygon' },
    { symbol: 'LINK', name: 'Chainlink' },
  ],
  US_STOCK: [
    { symbol: 'AAPL', name: 'Apple Inc.' },
    { symbol: 'MSFT', name: 'Microsoft' },
    { symbol: 'GOOGL', name: 'Alphabet (Google)' },
    { symbol: 'AMZN', name: 'Amazon' },
    { symbol: 'TSLA', name: 'Tesla' },
    { symbol: 'META', name: 'Meta Platforms' },
    { symbol: 'NFLX', name: 'Netflix' },
    { symbol: 'NVDA', name: 'NVIDIA' },
    { symbol: 'SSO', name: 'ProShares Ultra S&P500' },
    { symbol: 'QQQ', name: 'Invesco QQQ Trust' },
  ],
  IDX_STOCK: [
    { symbol: 'BBCA', name: 'Bank Central Asia' },
    { symbol: 'BBRI', name: 'Bank BRI' },
    { symbol: 'BMRI', name: 'Bank Mandiri' },
    { symbol: 'SMGR', name: 'Semen Indonesia' },
    { symbol: 'JSMR', name: 'Jasa Marga' },
    { symbol: 'TLKM', name: 'Telekomunikasi Indonesia' },
    { symbol: 'UNTR', name: 'United Tractors' },
    { symbol: 'PTBA', name: 'Bukit Asam' },
    { symbol: 'PGAS', name: 'PGN' },
    { symbol: 'ANTM', name: 'Aneka Tambang' },
    { symbol: 'CTRA', name: 'Ciputra Property' },
    { symbol: 'FORE', name: 'Fore Kopi Indonesia' },
    { symbol: 'DADA', name: 'Diamond Citra Propertindo' },
  ],
};

export class MarketPriceService {
  async getBySymbols(symbols: string[]) {
    return prisma.marketPrice.findMany({
      where: { symbol: { in: symbols } },
    });
  }

  async getBySymbol(symbol: string) {
    return prisma.marketPrice.findUnique({
      where: { symbol },
    });
  }

  async search(query: string, type?: AssetType) {
    const allAssets = [
      ...ASSET_LIST.CRYPTO.map((a) => ({ ...a, type: 'CRYPTO' as AssetType })),
      ...ASSET_LIST.US_STOCK.map((a) => ({ ...a, type: 'US_STOCK' as AssetType })),
      ...ASSET_LIST.IDX_STOCK.map((a) => ({ ...a, type: 'IDX_STOCK' as AssetType })),
    ];

    const filtered = allAssets.filter((a) => {
      const matchesQuery = a.symbol.toLowerCase().includes(query.toLowerCase()) ||
        a.name.toLowerCase().includes(query.toLowerCase());
      const matchesType = !type || a.type === type;
      return matchesQuery && matchesType;
    });

    return filtered;
  }

  async syncPrices() {
    const symbols = [
      ...ASSET_LIST.CRYPTO.map((a) => ({ ...a, type: 'CRYPTO' as AssetType })),
      ...ASSET_LIST.US_STOCK.map((a) => ({ ...a, type: 'US_STOCK' as AssetType })),
      ...ASSET_LIST.IDX_STOCK.map((a) => ({ ...a, type: 'IDX_STOCK' as AssetType })),
    ];

    const usdIdrRate = await fetchUsdIdrRate();
    const quotes = await fetchYahooFinanceBatch(symbols, usdIdrRate);

    for (const quote of quotes) {
      const asset = symbols.find((s) => s.symbol === quote.symbol);
      if (!asset) continue;

      await prisma.marketPrice.upsert({
        where: { symbol: quote.symbol },
        create: {
          symbol: quote.symbol,
          name: asset.name,
          type: asset.type,
          price: quote.price.toString(),
          currency: 'IDR',
        },
        update: {
          price: quote.price.toString(),
        },
      });
    }
  }
}

export const marketPriceService = new MarketPriceService();
