import { NextResponse } from 'next/server';

// Multi-exchange whale REST fallback (no API keys required)
// Aggregates recent large trades from Binance, Bybit, OKX, Coinbase, Kraken

const THRESHOLDS: Record<string, number> = {
  BTC: 500_000, ETH: 250_000, SOL: 100_000,
  XRP: 100_000, BNB: 100_000, ADA: 50_000,
};

function fmtUSD(v: number): string {
  if (v >= 1_000_000_000) return '$' + (v / 1_000_000_000).toFixed(2) + 'B';
  if (v >= 1_000_000)     return '$' + (v / 1_000_000).toFixed(1) + 'M';
  if (v >= 1_000)         return '$' + (v / 1_000).toFixed(0) + 'K';
  return '$' + v.toFixed(0);
}

function makeAlert(usd: number, isSell: boolean): string | null {
  if (usd > 10_000_000) return isSell ? '🐋 Mega sell' : '🐋 Mega buy';
  if (usd >  5_000_000) return isSell ? 'Large dump'   : 'Large accum.';
  if (usd >  2_000_000) return isSell ? 'Exchange inflow' : 'Exchange outflow';
  return null;
}

interface WhaleTrade {
  id: string; symbol: string; exchange: string;
  type: 'buy' | 'sell'; price: string; qty: string;
  usdValue: number; usdDisplay: string; time: string; alert: string | null;
}

function buildTrade(id: string, exchange: string, symbol: string, price: number, qty: number, isSell: boolean, ts: number): WhaleTrade | null {
  const usdValue  = price * qty;
  const threshold = THRESHOLDS[symbol] ?? 500_000;
  if (usdValue < threshold) return null;
  return {
    id, exchange, symbol, type: isSell ? 'sell' : 'buy',
    price: price.toLocaleString('en-US', { maximumFractionDigits: 2 }),
    qty: qty.toFixed(4), usdValue, usdDisplay: fmtUSD(usdValue),
    time: new Date(ts).toISOString(), alert: makeAlert(usdValue, isSell),
  };
}

// ── Binance ──────────────────────────────────────────────────────────────────
async function fetchBinance(): Promise<WhaleTrade[]> {
  const symbols = ['BTCUSDT','ETHUSDT','SOLUSDT','XRPUSDT','BNBUSDT','ADAUSDT'];
  const results = await Promise.allSettled(symbols.map(async sym => {
    const symbol = sym.replace('USDT','');
    const res = await fetch(`https://api.binance.com/api/v3/aggTrades?symbol=${sym}&limit=500`, {
      next: { revalidate: 30 }, signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const trades: any[] = await res.json();
    return trades.map(t => buildTrade(`bn-${t.a}`, 'Binance', symbol, parseFloat(t.p), parseFloat(t.q), t.m, t.T)).filter(Boolean) as WhaleTrade[];
  }));
  return results.flatMap(r => r.status === 'fulfilled' ? r.value : []);
}

// ── Bybit ────────────────────────────────────────────────────────────────────
async function fetchBybit(): Promise<WhaleTrade[]> {
  const symbols = ['BTCUSDT','ETHUSDT','SOLUSDT','XRPUSDT','ADAUSDT'];
  const results = await Promise.allSettled(symbols.map(async sym => {
    const symbol = sym.replace('USDT','');
    const res = await fetch(`https://api.bybit.com/v5/market/recent-trade?category=spot&symbol=${sym}&limit=500`, {
      next: { revalidate: 30 }, signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data?.result?.list ?? []).map((t: any) =>
      buildTrade(`by-${t.execId ?? t.tradeTime}`, 'Bybit', symbol, parseFloat(t.price), parseFloat(t.size), t.side === 'Sell', Number(t.time))
    ).filter(Boolean) as WhaleTrade[];
  }));
  return results.flatMap(r => r.status === 'fulfilled' ? r.value : []);
}

// ── OKX ──────────────────────────────────────────────────────────────────────
async function fetchOKX(): Promise<WhaleTrade[]> {
  const instruments = ['BTC-USDT','ETH-USDT','SOL-USDT','XRP-USDT','ADA-USDT'];
  const results = await Promise.allSettled(instruments.map(async instId => {
    const symbol = instId.replace('-USDT','');
    const res = await fetch(`https://www.okx.com/api/v5/market/trades?instId=${instId}&limit=500`, {
      next: { revalidate: 30 }, signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data?.data ?? []).map((t: any) =>
      buildTrade(`okx-${t.tradeId}`, 'OKX', symbol, parseFloat(t.px), parseFloat(t.sz), t.side === 'sell', Number(t.ts))
    ).filter(Boolean) as WhaleTrade[];
  }));
  return results.flatMap(r => r.status === 'fulfilled' ? r.value : []);
}

// ── Coinbase ──────────────────────────────────────────────────────────────────
async function fetchCoinbase(): Promise<WhaleTrade[]> {
  const pairs = ['BTC-USD','ETH-USD','SOL-USD','XRP-USD'];
  const results = await Promise.allSettled(pairs.map(async productId => {
    const symbol = productId.replace('-USD','');
    const res = await fetch(`https://api.coinbase.com/api/v3/brokerage/market/products/${productId}/ticker?limit=500`, {
      next: { revalidate: 30 }, signal: AbortSignal.timeout(5000),
      headers: { 'User-Agent': 'TradeIQ/1.0' },
    });
    if (!res.ok) return [];
    const data = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data?.trades ?? []).map((t: any) =>
      buildTrade(`cb-${t.trade_id}`, 'Coinbase', symbol, parseFloat(t.price), parseFloat(t.size), t.side === 'SELL', new Date(t.time).getTime())
    ).filter(Boolean) as WhaleTrade[];
  }));
  return results.flatMap(r => r.status === 'fulfilled' ? r.value : []);
}

// ── Kraken ───────────────────────────────────────────────────────────────────
async function fetchKraken(): Promise<WhaleTrade[]> {
  const pairs = [['XBTUSDT','BTC'],['ETHUSDT','ETH'],['SOLUSDT','SOL'],['XRPUSDT','XRP']];
  const results = await Promise.allSettled(pairs.map(async ([pair, symbol]) => {
    const res = await fetch(`https://api.kraken.com/0/public/Trades?pair=${pair}&count=1000`, {
      next: { revalidate: 30 }, signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const list = data?.result?.[pair] ?? data?.result?.[Object.keys(data?.result ?? {})[0]] ?? [];
    // Kraken trade format: [price, volume, time, side, orderType, misc, tradeId]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return list.map((t: any, i: number) =>
      buildTrade(`kr-${pair}-${i}`, 'Kraken', symbol, parseFloat(t[0]), parseFloat(t[1]), t[3] === 's', Math.floor(parseFloat(t[2]) * 1000))
    ).filter(Boolean) as WhaleTrade[];
  }));
  return results.flatMap(r => r.status === 'fulfilled' ? r.value : []);
}

export async function GET() {
  const [binance, bybit, okx, coinbase, kraken] = await Promise.allSettled([
    fetchBinance(), fetchBybit(), fetchOKX(), fetchCoinbase(), fetchKraken(),
  ]);

  const all: WhaleTrade[] = [
    ...(binance.status  === 'fulfilled' ? binance.value  : []),
    ...(bybit.status    === 'fulfilled' ? bybit.value    : []),
    ...(okx.status      === 'fulfilled' ? okx.value      : []),
    ...(coinbase.status === 'fulfilled' ? coinbase.value : []),
    ...(kraken.status   === 'fulfilled' ? kraken.value   : []),
  ];

  // Deduplicate approx: same symbol + type + USD bucket + time bucket (within 2s)
  const seen = new Set<string>();
  const deduped = all.filter(t => {
    const bucket = Math.floor(new Date(t.time).getTime() / 2000);
    const key = `${t.symbol}-${t.type}-${Math.round(t.usdValue / 1000)}-${bucket}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  deduped.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

  return NextResponse.json(deduped.slice(0, 50), {
    headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
  });
}
