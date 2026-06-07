import { NextRequest, NextResponse } from 'next/server';
import { getPairById } from '@/lib/pairConfig';
import { fetchBinanceOHLCV, fetchForexOHLCV, fetchStockOHLCV, aggregateCandles } from '@/lib/dataFetchers';

// ── Binance interval validation ──────────────────────────────────────────────
// These are the EXACT strings Binance accepts — no other values are valid
const VALID_BINANCE_INTERVALS = new Set([
  '1m','3m','5m','15m','30m','1h','2h','4h','6h','8h','12h','1d','3d','1w','1M'
]);

// UI timeframe → Binance interval (1:1 exact mapping, no guessing)
const TF_BINANCE: Record<string, string> = {
  '1m': '1m', '3m': '3m', '5m': '5m', '15m': '15m', '30m': '30m',
  '1h': '1h', '2h': '2h', '4h': '4h', '6h': '6h', '12h': '12h',
  '1D': '1d', '1W': '1w', '1M': '1M',
};

// How many candles to fetch per timeframe (Binance max = 1000)
const TF_LIMIT: Record<string, number> = {
  '1m': 300, '3m': 300, '5m': 300, '15m': 400, '30m': 500,
  '1h': 500, '2h': 500, '4h': 500, '6h': 500, '12h': 500,
  '1D': 365, '1W': 200, '1M': 60,
};

// ── Yahoo Finance config ─────────────────────────────────────────────────────
// Yahoo does NOT support 2h/4h/6h/12h directly — we fetch 1h and aggregate
const TF_YAHOO: Record<string, { interval: string; range: string; aggregateFactor?: number }> = {
  '1m':  { interval: '1m',  range: '7d'  },
  '3m':  { interval: '2m',  range: '7d'  },
  '5m':  { interval: '5m',  range: '7d'  },
  '15m': { interval: '15m', range: '7d'  },
  '30m': { interval: '30m', range: '1mo' },
  '1h':  { interval: '60m', range: '2mo' },
  '2h':  { interval: '60m', range: '3mo', aggregateFactor: 2 },
  '4h':  { interval: '60m', range: '6mo', aggregateFactor: 4 },
  '6h':  { interval: '60m', range: '6mo', aggregateFactor: 6 },
  '12h': { interval: '1d',  range: '1y',  aggregateFactor: 1 }, // daily is closest
  '1D':  { interval: '1d',  range: '1y'  },
  '1W':  { interval: '1wk', range: '5y'  },
  '1M':  { interval: '1mo', range: 'max' },
};

export async function GET(req: NextRequest, { params }: { params: Promise<{ pair: string }> }) {
  const { pair: pairId } = await params;
  const pair = getPairById(pairId);
  if (!pair) return NextResponse.json({ error: 'Unknown pair' }, { status: 404 });

  const tf = req.nextUrl.searchParams.get('tf') ?? '1h';

  try {
    let ohlcv;
    let dataSource = 'Unknown';

    // ── CRYPTO: Binance klines ONLY — never CoinGecko for charting ────────────
    // CoinGecko /ohlc auto-selects its OWN interval based on 'days' param:
    //   days=1  → ~30m candles, days=7-90 → 4h candles, days>90 → daily
    // This is why 1h charts showed 4h candles when Binance was unavailable.
    // Solution: if Binance fails, return error — do NOT fall back to CoinGecko.
    if (pair.market === 'crypto') {
      if (!pair.binanceSymbol) {
        return NextResponse.json({ error: 'No Binance symbol for this pair' }, { status: 400 });
      }

      // Validate the interval — catch any mismatch before calling Binance
      const binanceInterval = TF_BINANCE[tf];
      if (!binanceInterval || !VALID_BINANCE_INTERVALS.has(binanceInterval)) {
        return NextResponse.json(
          { error: `Unsupported timeframe "${tf}" for Binance. Valid: ${Object.keys(TF_BINANCE).join(', ')}` },
          { status: 400 }
        );
      }

      const limit = TF_LIMIT[tf] ?? 500;
      ohlcv = await fetchBinanceOHLCV(pair.binanceSymbol, binanceInterval, limit);
      dataSource = `Binance Klines (${binanceInterval} × ${limit})`;

      // Hard validation: check first two candles have the correct interval spacing
      if (ohlcv.length >= 2) {
        const intervalSeconds: Record<string, number> = {
          '1m':60,'3m':180,'5m':300,'15m':900,'30m':1800,
          '1h':3600,'2h':7200,'4h':14400,'6h':21600,'12h':43200,
          '1d':86400,'1w':604800,'1M':2592000,
        };
        const expectedSec = intervalSeconds[binanceInterval] ?? 3600;
        const actualGap   = ohlcv[1].time - ohlcv[0].time;
        // Allow ±5% tolerance for slight drift
        if (Math.abs(actualGap - expectedSec) > expectedSec * 0.05) {
          // Timestamps are wrong — likely milliseconds not divided by 1000
          // Re-divide all times by 1000 as emergency fix
          if (actualGap > expectedSec * 500) {
            ohlcv = ohlcv.map(c => ({ ...c, time: Math.floor(c.time / 1000) }));
            dataSource += ' [timestamp fixed]';
          }
        }
      }

    // ── FOREX / STOCKS / INDICES / COMMODITIES: Yahoo Finance ────────────────
    // Forex pairs now use Yahoo Finance tickers (EURUSD=X) for intraday data.
    // Frankfurter is no longer used — Yahoo gives 1h/4h/daily for all forex pairs.
    } else if (pair.ticker) {
      const yfCfg = TF_YAHOO[tf] ?? { interval: '1d', range: '1y' };
      ohlcv = await fetchStockOHLCV(pair.ticker, yfCfg.interval, yfCfg.range);

      // Aggregate if Yahoo doesn't support the exact timeframe natively
      // e.g. 2h = aggregate 2× 1h candles, 4h = aggregate 4× 1h candles
      if (yfCfg.aggregateFactor && yfCfg.aggregateFactor > 1) {
        ohlcv = aggregateCandles(ohlcv, yfCfg.aggregateFactor);
        dataSource = `Yahoo Finance (${yfCfg.interval} aggregated ×${yfCfg.aggregateFactor} → ${tf})`;
      } else {
        dataSource = `Yahoo Finance (${yfCfg.interval})`;
      }

    } else {
      return NextResponse.json({ error: 'Unsupported pair type' }, { status: 400 });
    }

    if (!ohlcv || !Array.isArray(ohlcv) || ohlcv.length === 0) {
      return NextResponse.json({ error: 'No data available from upstream source' }, { status: 503 });
    }

    // Crypto OHLCV is always fresh (cache: no-store in fetchBinanceOHLCV).
    // Forex/stocks update at most daily so 5-min CDN cache is fine.
    const cacheControl = pair.market === 'crypto'
      ? 'public, s-maxage=15, stale-while-revalidate=30'
      : 'public, s-maxage=300, stale-while-revalidate=600';

    return NextResponse.json(ohlcv, {
      headers: {
        'Cache-Control': cacheControl,
        'X-Data-Source': dataSource,
        'X-Candle-Count': String(ohlcv.length),
        'X-Timeframe': tf,
      },
    });

  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Upstream fetch error' },
      { status: 500 }
    );
  }
}
