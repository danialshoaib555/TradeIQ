import { NextRequest, NextResponse } from 'next/server';
import { getPairById } from '@/lib/pairConfig';
import { fetchCryptoOHLCV, fetchForexOHLCV, fetchStockOHLCV, fetchBinanceOHLCV } from '@/lib/dataFetchers';

// Binance interval strings
const TF_BINANCE: Record<string, string> = {
  '1m': '1m', '3m': '3m', '5m': '5m', '15m': '15m', '30m': '30m',
  '1h': '1h', '2h': '2h', '4h': '4h', '6h': '6h', '12h': '12h',
  '1D': '1d', '1W': '1w', '1M': '1M',
};

// Yahoo Finance interval + range combos
const TF_YAHOO: Record<string, { interval: string; range: string }> = {
  '1m':  { interval: '1m',  range: '5d'  },
  '3m':  { interval: '2m',  range: '5d'  },
  '5m':  { interval: '5m',  range: '5d'  },
  '15m': { interval: '15m', range: '5d'  },
  '30m': { interval: '30m', range: '1mo' },
  '1h':  { interval: '60m', range: '1mo' },
  '2h':  { interval: '60m', range: '3mo' },
  '4h':  { interval: '60m', range: '3mo' },
  '6h':  { interval: '1d',  range: '6mo' },
  '12h': { interval: '1d',  range: '6mo' },
  '1D':  { interval: '1d',  range: '1y'  },
  '1W':  { interval: '1wk', range: '5y'  },
  '1M':  { interval: '1mo', range: 'max' },
};

// CoinGecko days to fetch
const TF_CG_DAYS: Record<string, number> = {
  '1m': 1, '3m': 1, '5m': 1, '15m': 1, '30m': 2,
  '1h': 3, '2h': 7, '4h': 14, '6h': 14, '12h': 30,
  '1D': 90, '1W': 365, '1M': 365,
};

export async function GET(req: NextRequest, { params }: { params: Promise<{ pair: string }> }) {
  const { pair: pairId } = await params;
  const pair = getPairById(pairId);
  if (!pair) return NextResponse.json({ error: 'Unknown pair' }, { status: 404 });

  const tf = req.nextUrl.searchParams.get('tf') ?? '1h';

  try {
    let ohlcv;

    if (pair.market === 'crypto') {
      if (pair.binanceSymbol) {
        try {
          ohlcv = await fetchBinanceOHLCV(pair.binanceSymbol, TF_BINANCE[tf] ?? '1h', 200);
          if (!Array.isArray(ohlcv) || ohlcv.length === 0) throw new Error('empty');
        } catch {
          if (pair.coinGeckoId) {
            ohlcv = await fetchCryptoOHLCV(pair.coinGeckoId, Math.max(TF_CG_DAYS[tf] ?? 14, 14));
          }
        }
      } else if (pair.coinGeckoId) {
        ohlcv = await fetchCryptoOHLCV(pair.coinGeckoId, Math.max(TF_CG_DAYS[tf] ?? 14, 14));
      }
    } else if (pair.market === 'forex' && pair.base && pair.quote) {
      ohlcv = await fetchForexOHLCV(pair.base, pair.quote, 90);
    } else if ((pair.market === 'stocks' || pair.market === 'commodities' || pair.market === 'indices') && pair.ticker) {
      const yf = TF_YAHOO[tf] ?? { interval: '1d', range: '1y' };
      ohlcv = await fetchStockOHLCV(pair.ticker, yf.interval, yf.range);
    } else {
      return NextResponse.json({ error: 'Unsupported pair' }, { status: 400 });
    }

    if (!ohlcv || !Array.isArray(ohlcv) || ohlcv.length === 0) {
      return NextResponse.json({ error: 'No data available' }, { status: 503 });
    }

    return NextResponse.json(ohlcv, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Fetch error' }, { status: 500 });
  }
}
