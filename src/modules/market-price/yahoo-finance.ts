import type { AssetType } from '@prisma/client';

interface YahooQuote {
  symbol: string;
  price: number;
  name?: string;
}

let cachedUsdIdrRate: number | null = null;

export async function fetchUsdIdrRate(): Promise<number> {
  if (cachedUsdIdrRate) return cachedUsdIdrRate;
  
  try {
    const response = await fetch(
      'https://query1.finance.yahoo.com/v8/finance/chart/IDR=X?interval=1d&range=1d'
    );
    const data = await response.json();
    cachedUsdIdrRate = data.chart.result[0].meta.regularMarketPrice;
    return cachedUsdIdrRate;
  } catch {
    return 16500;
  }
}

export function getYahooSymbol(symbol: string, type: AssetType): string {
  switch (type) {
    case 'CRYPTO':
      return `${symbol}-USD`;
    case 'US_STOCK':
      return symbol;
    case 'IDX_STOCK':
      return `${symbol}.JK`;
  }
}

export async function fetchYahooFinanceBatch(
  symbols: { symbol: string; type: AssetType; name: string }[],
  usdIdrRate: number
): Promise<YahooQuote[]> {
  const results: YahooQuote[] = [];
  
  for (const { symbol, type, name } of symbols) {
    try {
      const yahooSymbol = getYahooSymbol(symbol, type);
      const response = await fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=1d&range=1d`
      );
      
      if (!response.ok) continue;
      
      const data = await response.json();
      let price = data.chart.result[0]?.meta?.regularMarketPrice;
      
      if (!price) continue;
      
      if (type === 'CRYPTO' || type === 'US_STOCK') {
        price = price * usdIdrRate;
      }
      
      results.push({ symbol, price, name });
    } catch {
      continue;
    }
  }
  
  return results;
}
