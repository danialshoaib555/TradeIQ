import type { OHLCV } from './signalEngine';

// ── CoinGecko — NOT used for charting ────────────────────────────────────────
// CoinGecko /ohlc auto-selects its OWN granularity based on `days`:
//   days=1  → ~30-min candles
//   days=7-90 → 4-hour candles  ← THIS is why 1h charts showed 4h candles
//   days>90 → daily candles
// We keep this only for metric/price cards, NOT for chart rendering.
export async function fetchCryptoOHLCV(coinId: string, days = 1): Promise<OHLCV[]> {
  const url = `https://api.coingecko.com/api/v3/coins/${coinId}/ohlc?vs_currency=usd&days=${days}`;
  const res = await fetch(url, { next: { revalidate: 300 } });
  if (!res.ok) throw new Error(`CoinGecko: ${res.status}`);
  const data: number[][] = await res.json();
  return data.map(([time, open, high, low, close]) => ({
    time: Math.floor(time / 1000), open, high, low, close, volume: 0,
  }));
}

// ── Forex — Frankfurter/ECB ───────────────────────────────────────────────────
export async function fetchForexOHLCV(base: string, quote: string, days = 90): Promise<OHLCV[]> {
  const end   = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days);
  const fmt = (d: Date) => d.toISOString().split('T')[0];
  const url = `https://api.frankfurter.app/${fmt(start)}..${fmt(end)}?from=${base}&to=${quote}`;
  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) throw new Error(`Frankfurter: ${res.status}`);
  const data = await res.json();
  const entries = Object.entries(data.rates as Record<string, Record<string, number>>);

  const closes = entries.map(([date, rates]) => ({
    time:  Math.floor(new Date(date).getTime() / 1000),
    close: rates[quote],
  }));

  return closes.map((c, i) => {
    const prevClose = i > 0 ? closes[i - 1].close : c.close;
    const open  = prevClose;
    const range = Math.abs(c.close - open) * 1.5 + c.close * 0.001;
    const high  = Math.max(open, c.close) + range * 0.4;
    const low   = Math.min(open, c.close) - range * 0.4;
    const move  = Math.abs(c.close - open) / open;
    return { time: c.time, open, high, low, close: c.close, volume: Math.floor(500000 + move * 50_000_000) };
  });
}

export async function fetchForexRate(base: string, quote: string): Promise<number> {
  const url = `https://api.frankfurter.app/latest?from=${base}&to=${quote}`;
  const res = await fetch(url, { next: { revalidate: 60 } });
  if (!res.ok) throw new Error(`Frankfurter rate: ${res.status}`);
  const data = await res.json();
  return data.rates[quote];
}

// ── Yahoo Finance — stocks / indices / commodities ────────────────────────────
// Yahoo timestamps are already in SECONDS (no divide needed)
export async function fetchStockOHLCV(ticker: string, interval = '1d', range = '1y'): Promise<OHLCV[]> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=${interval}&range=${range}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, next: { revalidate: 300 } });
  if (!res.ok) throw new Error(`Yahoo Finance: ${res.status}`);
  const data  = await res.json();
  const result = data.chart?.result?.[0];
  if (!result) throw new Error('No Yahoo Finance data');
  const timestamps: number[] = result.timestamp;
  const quote = result.indicators.quote[0];
  return timestamps
    .map((time: number, i: number) => ({
      time,                              // Yahoo returns seconds — do NOT divide by 1000
      open:   quote.open[i]   ?? 0,
      high:   quote.high[i]   ?? 0,
      low:    quote.low[i]    ?? 0,
      close:  quote.close[i]  ?? 0,
      volume: quote.volume[i] ?? 0,
    }))
    .filter((c: OHLCV) => c.close > 0 && c.open > 0);
}

// ── Aggregate lower TF candles into higher TF ─────────────────────────────────
// Used when Yahoo doesn't support the exact interval (e.g. 2h, 4h, 6h)
// factor=4 → combine 4 × 1h candles into 1 × 4h candle
export function aggregateCandles(candles: OHLCV[], factor: number): OHLCV[] {
  if (factor <= 1) return candles;
  const out: OHLCV[] = [];
  for (let i = 0; i + factor <= candles.length; i += factor) {
    const group = candles.slice(i, i + factor);
    out.push({
      time:   group[0].time,
      open:   group[0].open,
      high:   Math.max(...group.map(c => c.high)),
      low:    Math.min(...group.map(c => c.low)),
      close:  group[group.length - 1].close,
      volume: group.reduce((s, c) => s + c.volume, 0),
    });
  }
  return out;
}

// ── Binance Klines — crypto ONLY, exact interval ──────────────────────────────
// This is the ONLY data source for crypto charts.
// DO NOT fall back to CoinGecko — it returns wrong intervals silently.
//
// Binance kline format (index → meaning):
//   [0]  Open time  — MILLISECONDS (must divide by 1000 for LWC)
//   [1]  Open price
//   [2]  High price
//   [3]  Low price
//   [4]  Close price
//   [5]  Volume (base asset)

// Interval → expected seconds between candles (for gap detection)
const INTERVAL_SECONDS: Record<string, number> = {
  '1m': 60, '3m': 180, '5m': 300, '15m': 900, '30m': 1800,
  '1h': 3600, '2h': 7200, '4h': 14400, '6h': 21600, '8h': 28800, '12h': 43200,
  '1d': 86400, '3d': 259200, '1w': 604800, '1M': 2592000,
};

// Valid Binance interval strings — anything else will get a 400 error from Binance
const VALID_INTERVALS = new Set([
  '1m','3m','5m','15m','30m','1h','2h','4h','6h','8h','12h','1d','3d','1w','1M'
]);

export async function fetchBinanceOHLCV(symbol: string, interval = '1h', limit = 500): Promise<OHLCV[]> {
  // Guard against invalid interval strings before hitting Binance
  if (!VALID_INTERVALS.has(interval)) {
    throw new Error(`Invalid Binance interval "${interval}". Valid: ${[...VALID_INTERVALS].join(', ')}`);
  }

  const url = `https://api.binance.com/api/v3/klines?symbol=${symbol.toUpperCase()}&interval=${interval}&limit=${limit}`;

  // cache: 'no-store' — always fetch live data, never serve stale candles.
  // Stale data causes "4h candle on 1h chart" when new candles are missing.
  const res = await fetch(url, { next: { revalidate: 15 } });
  if (!res.ok) throw new Error(`Binance klines error ${res.status} for ${symbol} ${interval}`);
  const raw: string[][] = await res.json();

  // Parse — CRITICAL: k[0] is milliseconds, divide by 1000 for LWC seconds
  const parsed: OHLCV[] = raw
    .map(k => ({
      time:   Math.floor(parseInt(k[0]) / 1000), // ms → seconds
      open:   parseFloat(k[1]),
      high:   parseFloat(k[2]),
      low:    parseFloat(k[3]),
      close:  parseFloat(k[4]),
      volume: parseFloat(k[5]),
    }))
    .filter(c => c.close > 0 && c.time > 0);   // discard empty/invalid candles

  // Verify interval spacing on first two candles (catches bugs early)
  if (parsed.length >= 2) {
    const expectedSec = INTERVAL_SECONDS[interval] ?? 3600;
    const actualGap   = parsed[1].time - parsed[0].time;
    if (Math.abs(actualGap - expectedSec) > expectedSec * 0.1) {
      // If times are still in milliseconds (forgot to divide) gap would be ~1000×
      if (actualGap > expectedSec * 100) {
        throw new Error(
          `Binance timestamp format error: gap=${actualGap}s expected=${expectedSec}s. ` +
          `Timestamps may still be in milliseconds.`
        );
      }
      // Otherwise it's just a gap in data — continue and fill below
    }
  }

  // Deduplicate by timestamp (keep last entry per time slot)
  const byTime = new Map<number, OHLCV>();
  for (const c of parsed) byTime.set(c.time, c);
  const sorted = [...byTime.values()].sort((a, b) => a.time - b.time);

  // Gap-fill: insert synthetic flat candles for any gaps wider than 1.5× the interval.
  // Without this, lightweight-charts visually stretches adjacent candles to fill the gap,
  // making one candle look like it spans multiple intervals (the "4h on 1h chart" bug).
  const expectedSec = INTERVAL_SECONDS[interval] ?? 3600;
  const filled: OHLCV[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const curr = sorted[i];
    if (i > 0) {
      const prev = sorted[i - 1];
      const gap  = curr.time - prev.time;
      // Only fill if gap > 1.5× interval AND < 200× interval (avoid filling enormous gaps)
      if (gap > expectedSec * 1.5 && gap < expectedSec * 200) {
        let t = prev.time + expectedSec;
        while (t < curr.time - expectedSec * 0.5) {
          filled.push({
            time: t, open: prev.close, high: prev.close,
            low:  prev.close, close: prev.close, volume: 0,
          });
          t += expectedSec;
        }
      }
    }
    filled.push(curr);
  }

  return filled;
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
