export interface Pair {
  id: string;
  name: string;
  market: 'forex' | 'crypto' | 'stocks' | 'commodities' | 'indices';
  base?: string;
  quote?: string;
  ticker?: string;
  pipSize: number;
  coinGeckoId?: string;
  binanceSymbol?: string;
}

export const PAIRS: Pair[] = [
  // ── FOREX MAJORS ──────────────────────────────────────────────────────────
  { id: 'eurusd',  name: 'EUR/USD',  market: 'forex', base: 'EUR', quote: 'USD', pipSize: 0.0001 },
  { id: 'gbpusd',  name: 'GBP/USD',  market: 'forex', base: 'GBP', quote: 'USD', pipSize: 0.0001 },
  { id: 'usdjpy',  name: 'USD/JPY',  market: 'forex', base: 'USD', quote: 'JPY', pipSize: 0.01 },
  { id: 'usdchf',  name: 'USD/CHF',  market: 'forex', base: 'USD', quote: 'CHF', pipSize: 0.0001 },
  { id: 'usdcad',  name: 'USD/CAD',  market: 'forex', base: 'USD', quote: 'CAD', pipSize: 0.0001 },
  { id: 'audusd',  name: 'AUD/USD',  market: 'forex', base: 'AUD', quote: 'USD', pipSize: 0.0001 },
  { id: 'nzdusd',  name: 'NZD/USD',  market: 'forex', base: 'NZD', quote: 'USD', pipSize: 0.0001 },

  // ── FOREX MINORS ──────────────────────────────────────────────────────────
  { id: 'eurgbp',  name: 'EUR/GBP',  market: 'forex', base: 'EUR', quote: 'GBP', pipSize: 0.0001 },
  { id: 'eurjpy',  name: 'EUR/JPY',  market: 'forex', base: 'EUR', quote: 'JPY', pipSize: 0.01 },
  { id: 'gbpjpy',  name: 'GBP/JPY',  market: 'forex', base: 'GBP', quote: 'JPY', pipSize: 0.01 },
  { id: 'eurchf',  name: 'EUR/CHF',  market: 'forex', base: 'EUR', quote: 'CHF', pipSize: 0.0001 },
  { id: 'eurcad',  name: 'EUR/CAD',  market: 'forex', base: 'EUR', quote: 'CAD', pipSize: 0.0001 },
  { id: 'euraud',  name: 'EUR/AUD',  market: 'forex', base: 'EUR', quote: 'AUD', pipSize: 0.0001 },
  { id: 'eurnzd',  name: 'EUR/NZD',  market: 'forex', base: 'EUR', quote: 'NZD', pipSize: 0.0001 },
  { id: 'gbpchf',  name: 'GBP/CHF',  market: 'forex', base: 'GBP', quote: 'CHF', pipSize: 0.0001 },
  { id: 'gbpcad',  name: 'GBP/CAD',  market: 'forex', base: 'GBP', quote: 'CAD', pipSize: 0.0001 },
  { id: 'gbpaud',  name: 'GBP/AUD',  market: 'forex', base: 'GBP', quote: 'AUD', pipSize: 0.0001 },
  { id: 'gbpnzd',  name: 'GBP/NZD',  market: 'forex', base: 'GBP', quote: 'NZD', pipSize: 0.0001 },
  { id: 'audjpy',  name: 'AUD/JPY',  market: 'forex', base: 'AUD', quote: 'JPY', pipSize: 0.01 },
  { id: 'cadjpy',  name: 'CAD/JPY',  market: 'forex', base: 'CAD', quote: 'JPY', pipSize: 0.01 },
  { id: 'chfjpy',  name: 'CHF/JPY',  market: 'forex', base: 'CHF', quote: 'JPY', pipSize: 0.01 },
  { id: 'nzdjpy',  name: 'NZD/JPY',  market: 'forex', base: 'NZD', quote: 'JPY', pipSize: 0.01 },
  { id: 'audcad',  name: 'AUD/CAD',  market: 'forex', base: 'AUD', quote: 'CAD', pipSize: 0.0001 },
  { id: 'audchf',  name: 'AUD/CHF',  market: 'forex', base: 'AUD', quote: 'CHF', pipSize: 0.0001 },
  { id: 'audnzd',  name: 'AUD/NZD',  market: 'forex', base: 'AUD', quote: 'NZD', pipSize: 0.0001 },
  { id: 'nzdcad',  name: 'NZD/CAD',  market: 'forex', base: 'NZD', quote: 'CAD', pipSize: 0.0001 },
  { id: 'nzdchf',  name: 'NZD/CHF',  market: 'forex', base: 'NZD', quote: 'CHF', pipSize: 0.0001 },

  // ── FOREX EXOTICS ─────────────────────────────────────────────────────────
  { id: 'usdzar',  name: 'USD/ZAR',  market: 'forex', base: 'USD', quote: 'ZAR', pipSize: 0.001 },
  { id: 'usdmxn',  name: 'USD/MXN',  market: 'forex', base: 'USD', quote: 'MXN', pipSize: 0.001 },
  { id: 'usdtry',  name: 'USD/TRY',  market: 'forex', base: 'USD', quote: 'TRY', pipSize: 0.001 },
  { id: 'usdnok',  name: 'USD/NOK',  market: 'forex', base: 'USD', quote: 'NOK', pipSize: 0.0001 },
  { id: 'usdsek',  name: 'USD/SEK',  market: 'forex', base: 'USD', quote: 'SEK', pipSize: 0.0001 },
  { id: 'usddkk',  name: 'USD/DKK',  market: 'forex', base: 'USD', quote: 'DKK', pipSize: 0.0001 },
  { id: 'usdhkd',  name: 'USD/HKD',  market: 'forex', base: 'USD', quote: 'HKD', pipSize: 0.0001 },
  { id: 'usdsgd',  name: 'USD/SGD',  market: 'forex', base: 'USD', quote: 'SGD', pipSize: 0.0001 },
  { id: 'usdinr',  name: 'USD/INR',  market: 'forex', base: 'USD', quote: 'INR', pipSize: 0.01 },
  { id: 'usdbrl',  name: 'USD/BRL',  market: 'forex', base: 'USD', quote: 'BRL', pipSize: 0.0001 },
  { id: 'usdpln',  name: 'USD/PLN',  market: 'forex', base: 'USD', quote: 'PLN', pipSize: 0.0001 },
  { id: 'usdcnh',  name: 'USD/CNY',  market: 'forex', base: 'USD', quote: 'CNY', pipSize: 0.0001 },

  // ── CRYPTO ────────────────────────────────────────────────────────────────
  { id: 'btcusdt',   name: 'BTC/USDT',  market: 'crypto', pipSize: 1,      coinGeckoId: 'bitcoin',           binanceSymbol: 'BTCUSDT' },
  { id: 'ethusdt',   name: 'ETH/USDT',  market: 'crypto', pipSize: 0.1,    coinGeckoId: 'ethereum',          binanceSymbol: 'ETHUSDT' },
  { id: 'bnbusdt',   name: 'BNB/USDT',  market: 'crypto', pipSize: 0.01,   coinGeckoId: 'binancecoin',       binanceSymbol: 'BNBUSDT' },
  { id: 'solusdt',   name: 'SOL/USDT',  market: 'crypto', pipSize: 0.01,   coinGeckoId: 'solana',            binanceSymbol: 'SOLUSDT' },
  { id: 'xrpusdt',   name: 'XRP/USDT',  market: 'crypto', pipSize: 0.0001, coinGeckoId: 'ripple',            binanceSymbol: 'XRPUSDT' },
  { id: 'adausdt',   name: 'ADA/USDT',  market: 'crypto', pipSize: 0.0001, coinGeckoId: 'cardano',           binanceSymbol: 'ADAUSDT' },
  { id: 'dogeusdt',  name: 'DOGE/USDT', market: 'crypto', pipSize: 0.00001,coinGeckoId: 'dogecoin',          binanceSymbol: 'DOGEUSDT' },
  { id: 'avaxusdt',  name: 'AVAX/USDT', market: 'crypto', pipSize: 0.001,  coinGeckoId: 'avalanche-2',       binanceSymbol: 'AVAXUSDT' },
  { id: 'dotusdt',   name: 'DOT/USDT',  market: 'crypto', pipSize: 0.001,  coinGeckoId: 'polkadot',          binanceSymbol: 'DOTUSDT' },
  { id: 'linkusdt',  name: 'LINK/USDT', market: 'crypto', pipSize: 0.001,  coinGeckoId: 'chainlink',         binanceSymbol: 'LINKUSDT' },
  { id: 'maticusdt', name: 'MATIC/USDT',market: 'crypto', pipSize: 0.0001, coinGeckoId: 'matic-network',     binanceSymbol: 'MATICUSDT' },
  { id: 'uniusdt',   name: 'UNI/USDT',  market: 'crypto', pipSize: 0.001,  coinGeckoId: 'uniswap',           binanceSymbol: 'UNIUSDT' },
  { id: 'ltcusdt',   name: 'LTC/USDT',  market: 'crypto', pipSize: 0.01,   coinGeckoId: 'litecoin',          binanceSymbol: 'LTCUSDT' },
  { id: 'atomusdt',  name: 'ATOM/USDT', market: 'crypto', pipSize: 0.001,  coinGeckoId: 'cosmos',            binanceSymbol: 'ATOMUSDT' },
  { id: 'bchusdt',   name: 'BCH/USDT',  market: 'crypto', pipSize: 0.01,   coinGeckoId: 'bitcoin-cash',      binanceSymbol: 'BCHUSDT' },
  { id: 'nearusdt',  name: 'NEAR/USDT', market: 'crypto', pipSize: 0.001,  coinGeckoId: 'near',              binanceSymbol: 'NEARUSDT' },
  { id: 'aptusdt',   name: 'APT/USDT',  market: 'crypto', pipSize: 0.001,  coinGeckoId: 'aptos',             binanceSymbol: 'APTUSDT' },
  { id: 'arbusdt',   name: 'ARB/USDT',  market: 'crypto', pipSize: 0.0001, coinGeckoId: 'arbitrum',          binanceSymbol: 'ARBUSDT' },
  { id: 'opusdt',    name: 'OP/USDT',   market: 'crypto', pipSize: 0.0001, coinGeckoId: 'optimism',          binanceSymbol: 'OPUSDT' },
  { id: 'trxusdt',   name: 'TRX/USDT',  market: 'crypto', pipSize: 0.00001,coinGeckoId: 'tron',              binanceSymbol: 'TRXUSDT' },
  { id: 'tonusdt',   name: 'TON/USDT',  market: 'crypto', pipSize: 0.001,  coinGeckoId: 'the-open-network',  binanceSymbol: 'TONUSDT' },
  { id: 'shibusdt',  name: 'SHIB/USDT', market: 'crypto', pipSize: 0.000000001, coinGeckoId: 'shiba-inu',   binanceSymbol: 'SHIBUSDT' },
  { id: 'injusdt',   name: 'INJ/USDT',  market: 'crypto', pipSize: 0.001,  coinGeckoId: 'injective-protocol',binanceSymbol: 'INJUSDT' },
  { id: 'suiusdt',   name: 'SUI/USDT',  market: 'crypto', pipSize: 0.0001, coinGeckoId: 'sui',               binanceSymbol: 'SUIUSDT' },
  { id: 'filusdt',   name: 'FIL/USDT',  market: 'crypto', pipSize: 0.001,  coinGeckoId: 'filecoin',          binanceSymbol: 'FILUSDT' },
  { id: 'aaveusdt',  name: 'AAVE/USDT', market: 'crypto', pipSize: 0.01,   coinGeckoId: 'aave',              binanceSymbol: 'AAVEUSDT' },
  { id: 'mkrusdt',   name: 'MKR/USDT',  market: 'crypto', pipSize: 0.1,    coinGeckoId: 'maker',             binanceSymbol: 'MKRUSDT' },
  { id: 'pepeusdt',  name: 'PEPE/USDT', market: 'crypto', pipSize: 0.0000000001, coinGeckoId: 'pepe',       binanceSymbol: 'PEPEUSDT' },
  { id: 'ldousdt',   name: 'LDO/USDT',  market: 'crypto', pipSize: 0.0001, coinGeckoId: 'lido-dao',          binanceSymbol: 'LDOUSDT' },
  { id: 'ethbtc',    name: 'ETH/BTC',   market: 'crypto', pipSize: 0.000001, coinGeckoId: 'ethereum',        binanceSymbol: 'ETHBTC' },

  // ── STOCKS — US ───────────────────────────────────────────────────────────
  { id: 'aapl',  name: 'AAPL',   market: 'stocks', ticker: 'AAPL',  pipSize: 0.01 },
  { id: 'tsla',  name: 'TSLA',   market: 'stocks', ticker: 'TSLA',  pipSize: 0.01 },
  { id: 'nvda',  name: 'NVDA',   market: 'stocks', ticker: 'NVDA',  pipSize: 0.01 },
  { id: 'msft',  name: 'MSFT',   market: 'stocks', ticker: 'MSFT',  pipSize: 0.01 },
  { id: 'amzn',  name: 'AMZN',   market: 'stocks', ticker: 'AMZN',  pipSize: 0.01 },
  { id: 'googl', name: 'GOOGL',  market: 'stocks', ticker: 'GOOGL', pipSize: 0.01 },
  { id: 'meta',  name: 'META',   market: 'stocks', ticker: 'META',  pipSize: 0.01 },
  { id: 'nflx',  name: 'NFLX',   market: 'stocks', ticker: 'NFLX',  pipSize: 0.01 },
  { id: 'jpm',   name: 'JPM',    market: 'stocks', ticker: 'JPM',   pipSize: 0.01 },
  { id: 'amd',   name: 'AMD',    market: 'stocks', ticker: 'AMD',   pipSize: 0.01 },
  { id: 'coin',  name: 'COIN',   market: 'stocks', ticker: 'COIN',  pipSize: 0.01 },
  { id: 'uber',  name: 'UBER',   market: 'stocks', ticker: 'UBER',  pipSize: 0.01 },
  { id: 'pltr',  name: 'PLTR',   market: 'stocks', ticker: 'PLTR',  pipSize: 0.01 },
  { id: 'v',     name: 'VISA',   market: 'stocks', ticker: 'V',     pipSize: 0.01 },
  { id: 'baba',  name: 'BABA',   market: 'stocks', ticker: 'BABA',  pipSize: 0.01 },

  // ── STOCKS — GLOBAL ───────────────────────────────────────────────────────
  { id: 'tsm',   name: 'TSM',    market: 'stocks', ticker: 'TSM',   pipSize: 0.01 },
  { id: 'asml',  name: 'ASML',   market: 'stocks', ticker: 'ASML',  pipSize: 0.01 },
  { id: 'sap',   name: 'SAP',    market: 'stocks', ticker: 'SAP',   pipSize: 0.01 },
  { id: 'shop',  name: 'SHOP',   market: 'stocks', ticker: 'SHOP',  pipSize: 0.01 },
  { id: 'tm',    name: 'Toyota', market: 'stocks', ticker: 'TM',    pipSize: 0.01 },

  // ── INDICES ───────────────────────────────────────────────────────────────
  { id: 'sp500',    name: 'S&P 500',     market: 'indices', ticker: '^GSPC',  pipSize: 0.01 },
  { id: 'nasdaq',   name: 'NASDAQ',      market: 'indices', ticker: '^IXIC',  pipSize: 0.01 },
  { id: 'dow',      name: 'Dow Jones',   market: 'indices', ticker: '^DJI',   pipSize: 0.01 },
  { id: 'ftse',     name: 'FTSE 100',    market: 'indices', ticker: '^FTSE',  pipSize: 0.01 },
  { id: 'dax',      name: 'DAX',         market: 'indices', ticker: '^GDAXI', pipSize: 0.01 },
  { id: 'nikkei',   name: 'Nikkei 225',  market: 'indices', ticker: '^N225',  pipSize: 0.01 },
  { id: 'hangseng', name: 'Hang Seng',   market: 'indices', ticker: '^HSI',   pipSize: 0.01 },
  { id: 'cac40',    name: 'CAC 40',      market: 'indices', ticker: '^FCHI',  pipSize: 0.01 },

  // ── COMMODITIES ───────────────────────────────────────────────────────────
  { id: 'xauusd', name: 'XAU/USD',      market: 'commodities', ticker: 'GC=F',  pipSize: 0.01 },
  { id: 'xagusd', name: 'XAG/USD',      market: 'commodities', ticker: 'SI=F',  pipSize: 0.001 },
  { id: 'wtiusd', name: 'WTI Oil',      market: 'commodities', ticker: 'CL=F',  pipSize: 0.01 },
  { id: 'natgas', name: 'Natural Gas',  market: 'commodities', ticker: 'NG=F',  pipSize: 0.001 },
  { id: 'wheat',  name: 'Wheat',        market: 'commodities', ticker: 'ZW=F',  pipSize: 0.01 },
  { id: 'copper', name: 'Copper',       market: 'commodities', ticker: 'HG=F',  pipSize: 0.0001 },
  { id: 'xptusd', name: 'Platinum',     market: 'commodities', ticker: 'PL=F',  pipSize: 0.01 },
  { id: 'coffee', name: 'Coffee',       market: 'commodities', ticker: 'KC=F',  pipSize: 0.01 },
];

export function getPairById(id: string): Pair | undefined {
  return PAIRS.find(p => p.id === id);
}

export const MARKET_COLORS: Record<string, string> = {
  forex:       '#378ADD',
  crypto:      '#F7931A',
  stocks:      '#22C55E',
  commodities: '#F59E0B',
  indices:     '#A855F7',
};

export const MARKETS = ['all', 'forex', 'crypto', 'stocks', 'indices', 'commodities'] as const;
export type MarketFilter = typeof MARKETS[number];
