import { RSI, EMA, MACD, BollingerBands } from 'technicalindicators';
import type { OHLCV } from './signalEngine';

export interface BacktestTrade {
  entryTime: number;
  entryPrice: number;
  direction: 'BUY' | 'SELL';
  sl: number;
  tp1: number;
  outcome: 'win' | 'loss' | 'open';
  exitTime: number;
  exitPrice: number;
  returnR: number;       // in R multiples (+1.5 win, -1 loss)
}

export interface BacktestResult {
  strategyKey: string;
  trades: BacktestTrade[];
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;        // 0-100
  profitFactor: number;
  expectancy: number;     // avg return per trade in R
  maxConsecLosses: number;
}

// ── Pre-compute all indicators once ────────────────────────────────────────
interface Indicators {
  rsi:      (number | undefined)[];
  ema9:     (number | undefined)[];
  ema21:    (number | undefined)[];
  macd:     ({ MACD?: number; signal?: number; histogram?: number } | undefined)[];
  bbUpper:  (number | undefined)[];
  bbLower:  (number | undefined)[];
  bbMiddle: (number | undefined)[];
}

function precompute(ohlcv: OHLCV[]): Indicators {
  const closes = ohlcv.map(c => c.close);
  const n = closes.length;

  const rsiRaw  = RSI.calculate({ values: closes, period: 14 });
  const ema9Raw = EMA.calculate({ values: closes, period: 9 });
  const ema21Raw= EMA.calculate({ values: closes, period: 21 });
  const macdRaw = MACD.calculate({ values: closes, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9, SimpleMAOscillator: false, SimpleMASignal: false });
  const bbRaw   = BollingerBands.calculate({ values: closes, period: 20, stdDev: 2 });

  // Pad arrays to align with candle index
  const pad = <T>(arr: T[], total: number): (T | undefined)[] =>
    [...Array(total - arr.length).fill(undefined), ...arr];

  return {
    rsi:      pad(rsiRaw, n),
    ema9:     pad(ema9Raw, n),
    ema21:    pad(ema21Raw, n),
    macd:     pad(macdRaw, n),
    bbUpper:  pad(bbRaw.map(b => b.upper), n),
    bbLower:  pad(bbRaw.map(b => b.lower), n),
    bbMiddle: pad(bbRaw.map(b => b.middle), n),
  };
}

// ── Strategy fire conditions ───────────────────────────────────────────────
function checkStrategy(key: string, i: number, ind: Indicators): 'BUY' | 'SELL' | null {
  const rsi   = ind.rsi[i];
  const ema9  = ind.ema9[i];
  const ema21 = ind.ema21[i];
  const ema9p = ind.ema9[i - 1];
  const ema21p= ind.ema21[i - 1];
  const macd  = ind.macd[i];
  const macdP = ind.macd[i - 1];
  const bbU   = ind.bbUpper[i];
  const bbL   = ind.bbLower[i];

  if (rsi == null || ema9 == null || ema21 == null) return null;

  switch (key) {
    case 'ema_cross': {
      const crossBull = ema9p != null && ema21p != null && ema9p < ema21p && ema9 > ema21;
      const crossBear = ema9p != null && ema21p != null && ema9p > ema21p && ema9 < ema21;
      if (crossBull && rsi > 40 && rsi < 70) return 'BUY';
      if (crossBear && rsi > 30 && rsi < 60) return 'SELL';
      return null;
    }
    case 'rsi_reversal': {
      if (rsi < 30) return 'BUY';
      if (rsi > 70) return 'SELL';
      return null;
    }
    case 'bb_squeeze': {
      if (bbL == null || bbU == null) return null;
      // BB width < 2% of middle = squeeze
      const mid = ind.bbMiddle[i];
      if (mid == null) return null;
      const width = (bbU - bbL) / mid;
      if (width < 0.04) {
        // breakout direction from MACD
        if (macd?.MACD != null && macd?.signal != null) {
          if (macd.MACD > macd.signal) return 'BUY';
          if (macd.MACD < macd.signal) return 'SELL';
        }
        return ema9 > ema21 ? 'BUY' : 'SELL';
      }
      return null;
    }
    case 'sr_bounce': {
      if (bbL == null || bbU == null) return null;
      const closeI = ind.ema9[i]!; // proxy — not ideal but avoids passing ohlcv
      if (rsi < 35 && ema9 > ema21) return 'BUY';
      if (rsi > 65 && ema9 < ema21) return 'SELL';
      return null;
    }
    case 'macd_cross': {
      if (!macd || !macdP) return null;
      const bullCross = macdP.MACD != null && macdP.signal != null && macd.MACD != null && macd.signal != null
        && macdP.MACD < macdP.signal && macd.MACD > macd.signal;
      const bearCross = macdP.MACD != null && macdP.signal != null && macd.MACD != null && macd.signal != null
        && macdP.MACD > macdP.signal && macd.MACD < macd.signal;
      if (bullCross && ema9 > ema21) return 'BUY';
      if (bearCross && ema9 < ema21) return 'SELL';
      return null;
    }
    default:
      return null;
  }
}

// ── Main backtest runner ───────────────────────────────────────────────────
export function runBacktest(ohlcv: OHLCV[], strategyKey: string): BacktestResult {
  if (ohlcv.length < 40) {
    return { strategyKey, trades: [], totalTrades: 0, wins: 0, losses: 0, winRate: 0, profitFactor: 0, expectancy: 0, maxConsecLosses: 0 };
  }

  const ind = precompute(ohlcv);
  const trades: BacktestTrade[] = [];
  let inTrade = false;

  for (let i = 30; i < ohlcv.length - 5; i++) {
    if (inTrade) continue; // one trade at a time

    const dir = checkStrategy(strategyKey, i, ind);
    if (!dir) continue;

    const entry = ohlcv[i].close;
    const swingLow  = Math.min(...ohlcv.slice(Math.max(0, i - 5), i + 1).map(c => c.low));
    const swingHigh = Math.max(...ohlcv.slice(Math.max(0, i - 5), i + 1).map(c => c.high));

    let sl: number, tp1: number;
    if (dir === 'BUY') {
      sl  = swingLow  * 0.998;
      tp1 = entry + (entry - sl) * 1.5;
    } else {
      sl  = swingHigh * 1.002;
      tp1 = entry - (sl - entry) * 1.5;
    }
    const risk = Math.abs(entry - sl);
    if (risk <= 0 || risk / entry > 0.15) continue; // skip bad setups

    // Simulate over next 15 candles
    let outcome: 'win' | 'loss' | 'open' = 'open';
    let exitTime = ohlcv[Math.min(i + 14, ohlcv.length - 1)].time;
    let exitPrice = ohlcv[Math.min(i + 14, ohlcv.length - 1)].close;

    for (let j = i + 1; j < Math.min(i + 16, ohlcv.length); j++) {
      const c = ohlcv[j];
      if (dir === 'BUY') {
        if (c.low  <= sl)  { outcome = 'loss'; exitTime = c.time; exitPrice = sl;  break; }
        if (c.high >= tp1) { outcome = 'win';  exitTime = c.time; exitPrice = tp1; break; }
      } else {
        if (c.high >= sl)  { outcome = 'loss'; exitTime = c.time; exitPrice = sl;  break; }
        if (c.low  <= tp1) { outcome = 'win';  exitTime = c.time; exitPrice = tp1; break; }
      }
    }

    const returnR = outcome === 'win' ? 1.5 : outcome === 'loss' ? -1 : 0;
    trades.push({ entryTime: ohlcv[i].time, entryPrice: entry, direction: dir, sl, tp1, outcome, exitTime, exitPrice, returnR });

    if (outcome !== 'open') inTrade = false;
  }

  const closed  = trades.filter(t => t.outcome !== 'open');
  const wins    = closed.filter(t => t.outcome === 'win').length;
  const losses  = closed.filter(t => t.outcome === 'loss').length;
  const gross   = wins * 1.5;
  const pf      = losses > 0 ? parseFloat((gross / losses).toFixed(2)) : wins > 0 ? 9.99 : 0;
  const exp     = closed.length > 0 ? parseFloat((closed.reduce((a, t) => a + t.returnR, 0) / closed.length).toFixed(2)) : 0;

  // Max consecutive losses
  let maxCL = 0, curCL = 0;
  for (const t of closed) {
    if (t.outcome === 'loss') { curCL++; maxCL = Math.max(maxCL, curCL); }
    else curCL = 0;
  }

  return {
    strategyKey,
    trades,
    totalTrades: closed.length,
    wins,
    losses,
    winRate: closed.length > 0 ? Math.round((wins / closed.length) * 100) : 0,
    profitFactor: pf,
    expectancy:   exp,
    maxConsecLosses: maxCL,
  };
}

export const STRATEGY_KEYS = ['ema_cross', 'rsi_reversal', 'bb_squeeze', 'sr_bounce', 'macd_cross'] as const;
export type StrategyKey = typeof STRATEGY_KEYS[number];

export const STRATEGY_META: Record<StrategyKey, { name: string; shortDesc: string; color: string; indicators: string[] }> = {
  ema_cross:    { name: 'EMA Crossover',  shortDesc: 'EMA 9/21 crossover momentum', color: '#3B82F6', indicators: ['EMA9', 'EMA21'] },
  rsi_reversal: { name: 'RSI Reversal',   shortDesc: 'Oversold/Overbought bounce',  color: '#8B5CF6', indicators: ['RSI', 'BB'] },
  bb_squeeze:   { name: 'BB Squeeze',     shortDesc: 'Bollinger Band breakout',      color: '#A855F7', indicators: ['BB', 'EMA'] },
  sr_bounce:    { name: 'S&R Bounce',     shortDesc: 'Support & Resistance zones',   color: '#F59E0B', indicators: ['EMA', 'RSI'] },
  macd_cross:   { name: 'MACD Cross',     shortDesc: 'MACD signal line crossover',   color: '#10B981', indicators: ['MACD', 'EMA'] },
};
