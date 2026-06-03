import type { OHLCV } from './signalEngine';
import type { Pair } from './pairConfig';

export interface TradeLevels {
  entry: number;
  sl: number;
  tp1: number;
  tp2: number;
  tp3: number;
  riskPips: number;
  rr: number;
}

export function calculateLevels(ohlcv: OHLCV[], signal: 'BUY' | 'SELL' | 'WAIT', pair: Pair): TradeLevels | null {
  if (signal === 'WAIT' || ohlcv.length < 3) return null;

  const closes = ohlcv.map(c => c.close);
  const highs  = ohlcv.map(c => c.high);
  const lows   = ohlcv.map(c => c.low);

  const lastClose = closes.at(-1)!;
  const recentSwingLow  = Math.min(...lows.slice(-5));
  const recentSwingHigh = Math.max(...highs.slice(-5));

  let entry: number, sl: number, tp1: number, tp2: number, tp3: number;

  if (signal === 'BUY') {
    entry = lastClose;
    sl    = recentSwingLow * 0.998;
    const risk = entry - sl;
    if (risk <= 0) return null;
    tp1 = entry + risk * 1.5;
    tp2 = entry + risk * 2.5;
    tp3 = entry + risk * 4.0;
  } else {
    entry = lastClose;
    sl    = recentSwingHigh * 1.002;
    const risk = sl - entry;
    if (risk <= 0) return null;
    tp1 = entry - risk * 1.5;
    tp2 = entry - risk * 2.5;
    tp3 = entry - risk * 4.0;
  }

  const dp = pair.pipSize <= 0.0001 ? 5 : pair.pipSize <= 0.01 ? 3 : 2;
  const fmt = (v: number) => parseFloat(v.toFixed(dp));

  return {
    entry: fmt(entry), sl: fmt(sl),
    tp1: fmt(tp1), tp2: fmt(tp2), tp3: fmt(tp3),
    riskPips: Math.round(Math.abs(entry - sl) / pair.pipSize),
    rr: parseFloat((Math.abs(tp3 - entry) / Math.abs(entry - sl)).toFixed(1)),
  };
}
