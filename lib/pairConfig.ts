export interface Pair {
  id: string;
  name: string;
  market: 'forex' | 'crypto' | 'stocks' | 'commodities';
  base?: string;
  quote?: string;
  ticker?: string;
  pipSize: number;
  coinGeckoId?: string;
  binanceSymbol?: string;
}

export const PAIRS: Pair[] = [
  { id: 'eurusd', name: 'EUR/USD', market: 'forex', base: 'EUR', quote: 'USD', pipSize: 0.0001 },
  { id: 'gbpusd', name: 'GBP/USD', market: 'forex', base: 'GBP', quote: 'USD', pipSize: 0.0001 },
  { id: 'usdjpy', name: 'USD/JPY', market: 'forex', base: 'USD', quote: 'JPY', pipSize: 0.01 },
  { id: 'gbpjpy', name: 'GBP/JPY', market: 'forex', base: 'GBP', quote: 'JPY', pipSize: 0.01 },
  { id: 'audusd', name: 'AUD/USD', market: 'forex', base: 'AUD', quote: 'USD', pipSize: 0.0001 },
  { id: 'usdcad', name: 'USD/CAD', market: 'forex', base: 'USD', quote: 'CAD', pipSize: 0.0001 },
  { id: 'usdchf', name: 'USD/CHF', market: 'forex', base: 'USD', quote: 'CHF', pipSize: 0.0001 },
  { id: 'eurjpy', name: 'EUR/JPY', market: 'forex', base: 'EUR', quote: 'JPY', pipSize: 0.01 },
  { id: 'btcusdt', name: 'BTC/USDT', market: 'crypto', base: 'BTC', quote: 'USDT', pipSize: 1, coinGeckoId: 'bitcoin', binanceSymbol: 'BTCUSDT' },
  { id: 'ethusdt', name: 'ETH/USDT', market: 'crypto', base: 'ETH', quote: 'USDT', pipSize: 0.1, coinGeckoId: 'ethereum', binanceSymbol: 'ETHUSDT' },
  { id: 'bnbusdt', name: 'BNB/USDT', market: 'crypto', base: 'BNB', quote: 'USDT', pipSize: 0.01, coinGeckoId: 'binancecoin', binanceSymbol: 'BNBUSDT' },
  { id: 'solusdt', name: 'SOL/USDT', market: 'crypto', base: 'SOL', quote: 'USDT', pipSize: 0.01, coinGeckoId: 'solana', binanceSymbol: 'SOLUSDT' },
  { id: 'xrpusdt', name: 'XRP/USDT', market: 'crypto', base: 'XRP', quote: 'USDT', pipSize: 0.0001, coinGeckoId: 'ripple', binanceSymbol: 'XRPUSDT' },
  { id: 'adausdt', name: 'ADA/USDT', market: 'crypto', base: 'ADA', quote: 'USDT', pipSize: 0.0001, coinGeckoId: 'cardano', binanceSymbol: 'ADAUSDT' },
  { id: 'aapl', name: 'AAPL', market: 'stocks', ticker: 'AAPL', pipSize: 0.01 },
  { id: 'tsla', name: 'TSLA', market: 'stocks', ticker: 'TSLA', pipSize: 0.01 },
  { id: 'nvda', name: 'NVDA', market: 'stocks', ticker: 'NVDA', pipSize: 0.01 },
  { id: 'msft', name: 'MSFT', market: 'stocks', ticker: 'MSFT', pipSize: 0.01 },
  { id: 'amzn', name: 'AMZN', market: 'stocks', ticker: 'AMZN', pipSize: 0.01 },
  { id: 'xauusd', name: 'XAU/USD', market: 'commodities', base: 'XAU', quote: 'USD', pipSize: 0.01 },
  { id: 'xagusd', name: 'XAG/USD', market: 'commodities', base: 'XAG', quote: 'USD', pipSize: 0.001 },
  { id: 'wtiusd', name: 'WTI Oil', market: 'commodities', pipSize: 0.01 },
];

export function getPairById(id: string): Pair | undefined {
  return PAIRS.find(p => p.id === id);
}

export const MARKET_COLORS: Record<string, string> = {
  forex: '#378ADD',
  crypto: '#F7931A',
  stocks: '#22C55E',
  commodities: '#F59E0B',
};
