import { NextRequest, NextResponse } from 'next/server';
import { getPairById } from '@/lib/pairConfig';
import { fetchCryptoOHLCV, fetchForexOHLCV, fetchStockOHLCV, fetchBinanceOHLCV } from '@/lib/dataFetchers';

export async function GET(req: NextRequest, { params }: { params: Promise<{ pair: string }> }) {
  const { pair: pairId } = await params;
  const pair = getPairById(pairId);
  if (!pair) return NextResponse.json({ error: 'Unknown pair' }, { status: 404 });

  const tf = req.nextUrl.searchParams.get('tf') ?? '1h';

  try {
    let ohlcv;
    const ivMap: Record<string, string> = { '5m': '5m', '15m': '15m', '1h': '1h', '4h': '4h', '1D': '1d' };
    const daysMap: Record<string, number> = { '5m': 1, '15m': 1, '1h': 1, '4h': 7, '1D': 30 };
    const rangeMap: Record<string, string> = { '5m': '5d', '15m': '5d', '1h': '1mo', '4h': '3mo', '1D': '1y' };

    if (pair.market === 'crypto') {
      // Try Binance first, fall back to CoinGecko on any error (Binance is blocked in some regions)
      if (pair.binanceSymbol) {
        try {
          ohlcv = await fetchBinanceOHLCV(pair.binanceSymbol, ivMap[tf] ?? '1h', 150);
          if (!Array.isArray(ohlcv) || ohlcv.length === 0) throw new Error('empty');
        } catch {
          if (pair.coinGeckoId) {
            ohlcv = await fetchCryptoOHLCV(pair.coinGeckoId, Math.max(daysMap[tf] ?? 1, 14));
          }
        }
      } else if (pair.coinGeckoId) {
        ohlcv = await fetchCryptoOHLCV(pair.coinGeckoId, Math.max(daysMap[tf] ?? 1, 14));
      }
    } else if (pair.market === 'forex' && pair.base && pair.quote) {
      // Fetch 90 days to get enough candles for reliable indicator calculations
      ohlcv = await fetchForexOHLCV(pair.base, pair.quote, 90);
    } else if ((pair.market === 'stocks' || pair.market === 'commodities' || pair.market === 'indices') && pair.ticker) {
      ohlcv = await fetchStockOHLCV(pair.ticker, ivMap[tf] ?? '1d', rangeMap[tf] ?? '1mo');
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
