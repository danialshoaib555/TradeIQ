import type { OHLCV } from './signalEngine';

export async function fetchCryptoOHLCV(coinId: string, days = 1): Promise<OHLCV[]> {
  const url = `https://api.coingecko.com/api/v3/coins/${coinId}/ohlc?vs_currency=usd&days=${days}`;
  const res = await fetch(url, { next: { revalidate: 300 } });
  if (!res.ok) throw new Error(`CoinGecko: ${res.status}`);
  const data: number[][] = await res.json();
  return data.map(([time, open, high, low, close]) => ({
    time: Math.floor(time / 1000), open, high, low, close, volume: 0,
  }));
}

export async function fetchForexOHLCV(base: string, quote: string, days = 30): Promise<OHLCV[]> {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days);
  const fmt = (d: Date) => d.toISOString().split('T')[0];
  const url = `https://api.frankfurter.app/${fmt(start)}..${fmt(end)}?from=${base}&to=${quote}`;
  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) throw new Error(`Frankfurter: ${res.status}`);
  const data = await res.json();
  const entries = Object.entries(data.rates as Record<string, Record<string, number>>);
  // Build realistic candles: use prev close as open, derive high/low from daily range estimate
  const closes = entries.map(([date, rates]) => ({
    time: Math.floor(new Date(date).getTime() / 1000),
    close: rates[quote],
  }));

  return closes.map((c, i) => {
    const prevClose = i > 0 ? closes[i - 1].close : c.close;
    const open  = prevClose;
    const range = Math.abs(c.close - open) * 1.5 + c.close * 0.001;
    const high  = Math.max(open, c.close) + range * 0.4;
    const low   = Math.min(open, c.close) - range * 0.4;
    // Synthetic volume correlated with price movement magnitude
    const move  = Math.abs(c.close - open) / open;
    const volume = Math.floor(500000 + move * 50000000);
    return { time: c.time, open, high, low, close: c.close, volume };
  });
}

export async function fetchForexRate(base: string, quote: string): Promise<number> {
  const url = `https://api.frankfurter.app/latest?from=${base}&to=${quote}`;
  const res = await fetch(url, { next: { revalidate: 60 } });
  if (!res.ok) throw new Error(`Frankfurter rate: ${res.status}`);
  const data = await res.json();
  return data.rates[quote];
}

export async function fetchStockOHLCV(ticker: string, interval = '1d', range = '3mo'): Promise<OHLCV[]> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=${interval}&range=${range}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    next: { revalidate: 300 },
  });
  if (!res.ok) throw new Error(`Yahoo Finance: ${res.status}`);
  const data = await res.json();
  const result = data.chart?.result?.[0];
  if (!result) throw new Error('No Yahoo Finance data');
  const timestamps: number[] = result.timestamp;
  const quote = result.indicators.quote[0];
  return timestamps.map((time: number, i: number) => ({
    time, open: quote.open[i] ?? 0, high: quote.high[i] ?? 0,
    low: quote.low[i] ?? 0, close: quote.close[i] ?? 0, volume: quote.volume[i] ?? 0,
  })).filter((c: OHLCV) => c.close > 0);
}

export async function fetchBinanceOHLCV(symbol: string, interval = '1h', limit = 100): Promise<OHLCV[]> {
  const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
  const res = await fetch(url, { next: { revalidate: 60 } });
  if (!res.ok) throw new Error(`Binance: ${res.status}`);
  const data: string[][] = await res.json();
  return data.map(k => ({
    time:   Math.floor(parseInt(k[0]) / 1000),
    open:   parseFloat(k[1]),
    high:   parseFloat(k[2]),
    low:    parseFloat(k[3]),
    close:  parseFloat(k[4]),
    volume: parseFloat(k[5]),
  }));
}

export async function fetchFundingRate(symbol = 'BTCUSDT') {
  const url = `https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${symbol}`;
  const res = await fetch(url, { next: { revalidate: 60 } });
  if (!res.ok) throw new Error(`Binance futures: ${res.status}`);
  const data = await res.json();
  return {
    fundingRate:     parseFloat(data.lastFundingRate) * 100,
    nextFundingTime: new Date(data.nextFundingTime),
    markPrice:       parseFloat(data.markPrice),
  };
}
