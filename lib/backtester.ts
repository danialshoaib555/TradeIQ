import { RSI, EMA, MACD, BollingerBands, Stochastic, ATR } from 'technicalindicators';
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
  returnR: number;
}

export interface BacktestResult {
  strategyKey: string;
  trades: BacktestTrade[];
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  profitFactor: number;
  expectancy: number;
  maxConsecLosses: number;
}

// ── Pre-compute all indicators once ────────────────────────────────────────
interface Indicators {
  rsi:       (number | undefined)[];
  ema9:      (number | undefined)[];
  ema21:     (number | undefined)[];
  ema50:     (number | undefined)[];
  ema200:    (number | undefined)[];
  macd:      ({ MACD?: number; signal?: number; histogram?: number } | undefined)[];
  bbUpper:   (number | undefined)[];
  bbLower:   (number | undefined)[];
  bbMiddle:  (number | undefined)[];
  stochK:    (number | undefined)[];
  stochD:    (number | undefined)[];
  atr:       (number | undefined)[];
}

function precompute(ohlcv: OHLCV[]): Indicators {
  const closes = ohlcv.map(c => c.close);
  const highs  = ohlcv.map(c => c.high);
  const lows   = ohlcv.map(c => c.low);
  const n = closes.length;

  const pad = <T>(arr: T[], total: number): (T | undefined)[] =>
    [...Array(total - arr.length).fill(undefined), ...arr];

  const rsiRaw   = RSI.calculate({ values: closes, period: 14 });
  const ema9Raw  = EMA.calculate({ values: closes, period: 9 });
  const ema21Raw = EMA.calculate({ values: closes, period: 21 });
  const ema50Raw = EMA.calculate({ values: closes, period: 50 });
  const ema200Raw= EMA.calculate({ values: closes, period: 200 });
  const macdRaw  = MACD.calculate({ values: closes, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9, SimpleMAOscillator: false, SimpleMASignal: false });
  const bbRaw    = BollingerBands.calculate({ values: closes, period: 20, stdDev: 2 });
  const atrRaw   = ATR.calculate({ high: highs, low: lows, close: closes, period: 14 });

  let stochK: (number | undefined)[] = Array(n).fill(undefined);
  let stochD: (number | undefined)[] = Array(n).fill(undefined);
  try {
    const stochRaw = Stochastic.calculate({ high: highs, low: lows, close: closes, period: 14, signalPeriod: 3 });
    const stochKRaw = stochRaw.map(s => s.k);
    const stochDRaw = stochRaw.map(s => s.d);
    stochK = pad(stochKRaw, n);
    stochD = pad(stochDRaw, n);
  } catch {}

  return {
    rsi:      pad(rsiRaw, n),
    ema9:     pad(ema9Raw, n),
    ema21:    pad(ema21Raw, n),
    ema50:    pad(ema50Raw, n),
    ema200:   pad(ema200Raw, n),
    macd:     pad(macdRaw, n),
    bbUpper:  pad(bbRaw.map(b => b.upper), n),
    bbLower:  pad(bbRaw.map(b => b.lower), n),
    bbMiddle: pad(bbRaw.map(b => b.middle), n),
    stochK,
    stochD,
    atr:      pad(atrRaw, n),
  };
}

// ── Candle pattern helpers ─────────────────────────────────────────────────
function isPinBarBull(c: OHLCV): boolean {
  const body = Math.abs(c.close - c.open);
  const lowerWick = Math.min(c.open, c.close) - c.low;
  const upperWick = c.high - Math.max(c.open, c.close);
  return lowerWick > body * 2 && upperWick < body * 0.5;
}

function isPinBarBear(c: OHLCV): boolean {
  const body = Math.abs(c.close - c.open);
  const upperWick = c.high - Math.max(c.open, c.close);
  const lowerWick = Math.min(c.open, c.close) - c.low;
  return upperWick > body * 2 && lowerWick < body * 0.5;
}

function isBullEngulf(prev: OHLCV, curr: OHLCV): boolean {
  return prev.close < prev.open && curr.close > curr.open &&
    curr.open < prev.close && curr.close > prev.open;
}

function isBearEngulf(prev: OHLCV, curr: OHLCV): boolean {
  return prev.close > prev.open && curr.close < curr.open &&
    curr.open > prev.close && curr.close < prev.open;
}

function donchianHigh(ohlcv: OHLCV[], i: number, period = 20): number {
  return Math.max(...ohlcv.slice(Math.max(0, i - period), i).map(c => c.high));
}

function donchianLow(ohlcv: OHLCV[], i: number, period = 20): number {
  return Math.min(...ohlcv.slice(Math.max(0, i - period), i).map(c => c.low));
}

// ── Strategy fire conditions ───────────────────────────────────────────────
function checkStrategy(key: string, i: number, ind: Indicators, ohlcv: OHLCV[]): 'BUY' | 'SELL' | null {
  const rsi    = ind.rsi[i];
  const ema9   = ind.ema9[i];
  const ema21  = ind.ema21[i];
  const ema50  = ind.ema50[i];
  const ema9p  = ind.ema9[i - 1];
  const ema21p = ind.ema21[i - 1];
  const macd   = ind.macd[i];
  const macdP  = ind.macd[i - 1];
  const bbU    = ind.bbUpper[i];
  const bbL    = ind.bbLower[i];
  const bbM    = ind.bbMiddle[i];
  const skK    = ind.stochK[i];
  const skD    = ind.stochD[i];
  const skKp   = ind.stochK[i - 1];
  const skDp   = ind.stochD[i - 1];
  const atr    = ind.atr[i];

  if (rsi == null || ema9 == null || ema21 == null) return null;

  const candle  = ohlcv[i];
  const prevC   = ohlcv[i - 1];
  const close   = candle.close;

  switch (key) {
    // ── Category 1: Trend Following ────────────────────────────────────────
    case 'ema_cross': {
      const crossBull = ema9p != null && ema21p != null && ema9p < ema21p && ema9 > ema21;
      const crossBear = ema9p != null && ema21p != null && ema9p > ema21p && ema9 < ema21;
      if (crossBull && rsi > 40 && rsi < 70) return 'BUY';
      if (crossBear && rsi > 30 && rsi < 60) return 'SELL';
      return null;
    }
    case 'trend_pullback': {
      // Price pulls back to EMA21 in an uptrend (EMA9 > EMA21 > EMA50)
      if (ema50 == null) return null;
      const uptrend = ema9 > ema21 && ema21 > ema50;
      const downtrend = ema9 < ema21 && ema21 < ema50;
      const pullbackBuy  = uptrend   && close <= ema21 * 1.002 && close >= ema21 * 0.998 && rsi > 40 && rsi < 60;
      const pullbackSell = downtrend && close >= ema21 * 0.998 && close <= ema21 * 1.002 && rsi > 40 && rsi < 60;
      if (pullbackBuy)  return 'BUY';
      if (pullbackSell) return 'SELL';
      return null;
    }
    case 'supertrend': {
      // Simplified Supertrend using ATR: if price > EMA21 + ATR → uptrend, below EMA21 - ATR → downtrend
      if (atr == null) return null;
      const supLine = ema21;
      const bullBreak = close > supLine + atr * 0.5 && prevC.close <= supLine + atr * 0.5 && rsi > 50;
      const bearBreak = close < supLine - atr * 0.5 && prevC.close >= supLine - atr * 0.5 && rsi < 50;
      if (bullBreak) return 'BUY';
      if (bearBreak) return 'SELL';
      return null;
    }
    case 'ma_ribbon': {
      // MA Ribbon: all EMAs aligned (9 > 21 > 50) and momentum candle
      if (ema50 == null) return null;
      const ribbonBull = ema9 > ema21 && ema21 > ema50 && rsi > 50 && rsi < 75 && close > ema9;
      const ribbonBear = ema9 < ema21 && ema21 < ema50 && rsi < 50 && rsi > 25 && close < ema9;
      if (ribbonBull && (!ema9p || !ema21p || ema9p < ema21p || close > ema9 * 1.001)) return 'BUY';
      if (ribbonBear && (!ema9p || !ema21p || ema9p > ema21p || close < ema9 * 0.999)) return 'SELL';
      return null;
    }

    // ── Category 2: Reversal ──────────────────────────────────────────────
    case 'rsi_divergence': {
      // RSI divergence: price makes new low but RSI is higher than previous low (bullish div)
      if (i < 5) return null;
      const prevLow  = Math.min(...ohlcv.slice(i - 5, i).map(c => c.low));
      const prevRSI  = ind.rsi.slice(i - 5, i).filter(Boolean) as number[];
      if (prevRSI.length < 3) return null;
      const prevMinRSI = Math.min(...prevRSI);
      const prevMaxRSI = Math.max(...prevRSI);
      // Bullish div: price lower low, RSI higher low
      if (close < prevLow && rsi > prevMinRSI + 5 && rsi < 40) return 'BUY';
      // Bearish div: price higher high, RSI lower high
      const prevHigh = Math.max(...ohlcv.slice(i - 5, i).map(c => c.high));
      if (close > prevHigh && rsi < prevMaxRSI - 5 && rsi > 60) return 'SELL';
      return null;
    }
    case 'double_bottom': {
      // Two lows at similar level with RSI recovery
      if (i < 10) return null;
      const recent = ohlcv.slice(i - 10, i + 1);
      const lows = recent.map(c => c.low);
      const minLow = Math.min(...lows);
      const firstLowIdx = lows.indexOf(minLow);
      // Find second low close to first
      const secondLow = Math.min(...lows.slice(firstLowIdx + 2));
      const isDoubleBot = secondLow < minLow * 1.01 && secondLow > minLow * 0.99 && rsi < 45 && close > minLow * 1.005;
      // Double top
      const highs2 = recent.map(c => c.high);
      const maxHigh = Math.max(...highs2);
      const firstHighIdx = highs2.indexOf(maxHigh);
      const secondHigh = Math.max(...highs2.slice(firstHighIdx + 2));
      const isDoubleTop = secondHigh > maxHigh * 0.99 && secondHigh < maxHigh * 1.01 && rsi > 55 && close < maxHigh * 0.995;
      if (isDoubleBot) return 'BUY';
      if (isDoubleTop) return 'SELL';
      return null;
    }
    case 'pin_bar': {
      if (!prevC) return null;
      if (isPinBarBull(candle) && rsi < 45 && ema9 > ema21) return 'BUY';
      if (isPinBarBear(candle) && rsi > 55 && ema9 < ema21) return 'SELL';
      return null;
    }
    case 'engulfing': {
      if (!prevC) return null;
      if (isBullEngulf(prevC, candle) && rsi < 50) return 'BUY';
      if (isBearEngulf(prevC, candle) && rsi > 50) return 'SELL';
      return null;
    }
    case 'head_shoulders': {
      // Simplified: look for 3-peak pattern using 15 candle window
      if (i < 15) return null;
      const seg = ohlcv.slice(i - 15, i + 1).map(c => c.close);
      const peak1 = Math.max(...seg.slice(0, 5));
      const trough = Math.min(...seg.slice(5, 10));
      const peak2  = Math.max(...seg.slice(7, 12));
      const trough2= Math.min(...seg.slice(10, 14));
      const peak3  = Math.max(...seg.slice(12));
      // Head is highest (peak2 > peak1 && peak2 > peak3), neckline break
      if (peak2 > peak1 * 1.005 && peak2 > peak3 * 1.005 && peak1 > trough * 1.01 && peak3 > trough2 * 1.01 &&
          close < Math.max(trough, trough2) && rsi < 50) return 'SELL';
      // Inverse H&S for buys
      const low1 = Math.min(...seg.slice(0, 5));
      const peak_m = Math.max(...seg.slice(5, 10));
      const low2 = Math.min(...seg.slice(7, 12));
      const peak_m2= Math.max(...seg.slice(10, 14));
      const low3 = Math.min(...seg.slice(12));
      if (low2 < low1 * 0.995 && low2 < low3 * 0.995 && close > Math.min(peak_m, peak_m2) && rsi > 50) return 'BUY';
      return null;
    }

    // ── Category 3: Breakout ──────────────────────────────────────────────
    case 'bb_squeeze': {
      if (bbL == null || bbU == null || bbM == null) return null;
      const width = (bbU - bbL) / bbM;
      if (width < 0.04) {
        if (macd?.MACD != null && macd?.signal != null) {
          if (macd.MACD > macd.signal) return 'BUY';
          if (macd.MACD < macd.signal) return 'SELL';
        }
        return ema9 > ema21 ? 'BUY' : 'SELL';
      }
      return null;
    }
    case 'donchian': {
      if (i < 21) return null;
      const dcHigh = donchianHigh(ohlcv, i, 20);
      const dcLow  = donchianLow(ohlcv, i, 20);
      if (close > dcHigh * 0.999 && rsi > 50 && rsi < 75) return 'BUY';
      if (close < dcLow  * 1.001 && rsi < 50 && rsi > 25) return 'SELL';
      return null;
    }
    case 'orb': {
      // Opening range breakout: use first 3 candles of dataset as "range"
      if (i < 5) return null;
      const orbH = Math.max(...ohlcv.slice(0, 3).map(c => c.high));
      const orbL = Math.min(...ohlcv.slice(0, 3).map(c => c.low));
      if (close > orbH && prevC.close <= orbH && rsi > 50) return 'BUY';
      if (close < orbL && prevC.close >= orbL && rsi < 50) return 'SELL';
      return null;
    }

    // ── Category 4: Institutional / Smart Money ───────────────────────────
    case 'order_block': {
      // Order block: strong impulse candle followed by return to origin
      if (i < 5) return null;
      const impulse = ohlcv[i - 3];
      const impBody = Math.abs(impulse.close - impulse.open);
      const impRange = impulse.high - impulse.low;
      const isStrongCandle = impBody > impRange * 0.7;
      if (!isStrongCandle) return null;
      const bullOB = impulse.close > impulse.open && close <= impulse.open * 1.002 && close >= impulse.open * 0.998 && rsi < 50;
      const bearOB = impulse.close < impulse.open && close >= impulse.open * 0.998 && close <= impulse.open * 1.002 && rsi > 50;
      if (bullOB) return 'BUY';
      if (bearOB) return 'SELL';
      return null;
    }
    case 'liquidity_grab': {
      // Price spikes below recent low (sweep) and immediately reverses
      if (i < 5) return null;
      const recentLow  = Math.min(...ohlcv.slice(i - 5, i).map(c => c.low));
      const recentHigh = Math.max(...ohlcv.slice(i - 5, i).map(c => c.high));
      const grabbed_low  = candle.low < recentLow && candle.close > recentLow && rsi < 40;
      const grabbed_high = candle.high > recentHigh && candle.close < recentHigh && rsi > 60;
      if (grabbed_low)  return 'BUY';
      if (grabbed_high) return 'SELL';
      return null;
    }
    case 'fvg': {
      // Fair Value Gap: gap between candle[i-2].high and candle[i].low (bullish FVG)
      if (i < 3) return null;
      const c2 = ohlcv[i - 2];
      const bullFVG = c2.high < candle.low && close <= candle.low * 1.001 && close >= c2.high * 0.999 && rsi < 55;
      const bearFVG = c2.low > candle.high && close >= candle.high * 0.999 && close <= c2.low * 1.001 && rsi > 45;
      if (bullFVG) return 'BUY';
      if (bearFVG) return 'SELL';
      return null;
    }
    case 'structure_break': {
      // Market structure break: new high in downtrend = BOS bullish
      if (i < 10) return null;
      const prevSwingHigh = Math.max(...ohlcv.slice(i - 10, i - 2).map(c => c.high));
      const prevSwingLow  = Math.min(...ohlcv.slice(i - 10, i - 2).map(c => c.low));
      const bos_bull = close > prevSwingHigh && prevC.close <= prevSwingHigh && rsi > 50;
      const bos_bear = close < prevSwingLow  && prevC.close >= prevSwingLow  && rsi < 50;
      if (bos_bull) return 'BUY';
      if (bos_bear) return 'SELL';
      return null;
    }

    // ── Category 5: Momentum ──────────────────────────────────────────────
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
    case 'stoch_rsi': {
      if (skK == null || skD == null || skKp == null || skDp == null) return null;
      const bullCross = skKp < skDp && skK > skD && skK < 30;
      const bearCross = skKp > skDp && skK < skD && skK > 70;
      if (bullCross) return 'BUY';
      if (bearCross) return 'SELL';
      return null;
    }
    case 'vpa': {
      // Volume Price Analysis: strong candle with high relative volume
      const vol = candle.volume ?? 0;
      const avgVol = ohlcv.slice(Math.max(0, i - 14), i).reduce((a, c) => a + (c.volume ?? 0), 0) / 14;
      if (avgVol === 0) return null;
      const highVol = vol > avgVol * 1.5;
      const bullCandle = candle.close > candle.open && (candle.close - candle.open) / (candle.high - candle.low) > 0.6;
      const bearCandle = candle.close < candle.open && (candle.open - candle.close) / (candle.high - candle.low) > 0.6;
      if (highVol && bullCandle && rsi < 70) return 'BUY';
      if (highVol && bearCandle && rsi > 30) return 'SELL';
      return null;
    }

    // ── Category 6: Range / Mean Reversion ───────────────────────────────
    case 'rsi_reversal': {
      if (rsi < 30) return 'BUY';
      if (rsi > 70) return 'SELL';
      return null;
    }
    case 'keltner': {
      // Keltner Channel mean reversion using EMA21 ± 2*ATR
      if (atr == null) return null;
      const kUpper = ema21 + atr * 2;
      const kLower = ema21 - atr * 2;
      if (close < kLower && rsi < 40) return 'BUY';
      if (close > kUpper && rsi > 60) return 'SELL';
      return null;
    }

    // ── Category 7: News ──────────────────────────────────────────────────
    case 'news_trade': {
      // Simulate news impact: large ATR spike candle
      if (atr == null) return null;
      const prevAtr = ind.atr[i - 1];
      if (prevAtr == null) return null;
      const candleRange = candle.high - candle.low;
      const atrSpike = candleRange > atr * 2.5;
      if (!atrSpike) return null;
      if (candle.close > candle.open && rsi > 50) return 'BUY';
      if (candle.close < candle.open && rsi < 50) return 'SELL';
      return null;
    }
    case 'news_confluence': {
      // News + trend confluence: ATR spike in direction of trend
      if (atr == null || ema50 == null) return null;
      const candleRange = candle.high - candle.low;
      const atrSpike = candleRange > atr * 2;
      if (!atrSpike) return null;
      const inUptrend  = ema9 > ema21 && ema21 > ema50;
      const inDowntrend= ema9 < ema21 && ema21 < ema50;
      if (candle.close > candle.open && inUptrend && rsi < 75) return 'BUY';
      if (candle.close < candle.open && inDowntrend && rsi > 25) return 'SELL';
      return null;
    }

    // ── Category 8: Multi-Timeframe ───────────────────────────────────────
    case 'mtf_analysis': {
      // Simulated MTF: use EMA50 as higher-TF bias + EMA9/21 crossover for entry
      if (ema50 == null) return null;
      const hTfBull = close > ema50 && ema9 > ema21;
      const hTfBear = close < ema50 && ema9 < ema21;
      const crossBull = ema9p != null && ema21p != null && ema9p < ema21p && ema9 > ema21;
      const crossBear = ema9p != null && ema21p != null && ema9p > ema21p && ema9 < ema21;
      if (hTfBull && crossBull && rsi > 45 && rsi < 70) return 'BUY';
      if (hTfBear && crossBear && rsi < 55 && rsi > 30) return 'SELL';
      return null;
    }
    case 'weekly_level': {
      // Weekly level + daily: use EMA200 as weekly proxy
      if (ind.ema200[i] == null || ema50 == null) return null;
      const ema200 = ind.ema200[i]!;
      const nearWeekly = Math.abs(close - ema200) / ema200 < 0.005;
      if (!nearWeekly) return null;
      if (close > ema200 && ema9 > ema21 && rsi < 60) return 'BUY';
      if (close < ema200 && ema9 < ema21 && rsi > 40) return 'SELL';
      return null;
    }

    // ── Legacy S&R bounce ─────────────────────────────────────────────────
    case 'sr_bounce': {
      if (rsi < 35 && ema9 > ema21) return 'BUY';
      if (rsi > 65 && ema9 < ema21) return 'SELL';
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
    if (inTrade) continue;

    const dir = checkStrategy(strategyKey, i, ind, ohlcv);
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
    if (risk <= 0 || risk / entry > 0.15) continue;

    let outcome: 'win' | 'loss' | 'open' = 'open';
    let exitTime  = ohlcv[Math.min(i + 14, ohlcv.length - 1)].time;
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

export const STRATEGY_KEYS = [
  // Trend Following
  'ema_cross', 'trend_pullback', 'supertrend', 'ma_ribbon',
  // Reversal
  'rsi_divergence', 'double_bottom', 'head_shoulders', 'pin_bar', 'engulfing',
  // Breakout
  'bb_squeeze', 'donchian', 'orb',
  // Institutional
  'order_block', 'liquidity_grab', 'fvg', 'structure_break',
  // Momentum
  'macd_cross', 'stoch_rsi', 'vpa',
  // Range / Mean Reversion
  'rsi_reversal', 'keltner',
  // News
  'news_trade', 'news_confluence',
  // Multi-Timeframe
  'mtf_analysis', 'weekly_level',
] as const;

export type StrategyKey = typeof STRATEGY_KEYS[number];

export type StrategyCategory = 'trend' | 'reversal' | 'breakout' | 'institutional' | 'momentum' | 'range' | 'news' | 'mtf';
export type Difficulty = 'beginner' | 'intermediate' | 'advanced';

export interface StrategyMeta {
  name: string;
  shortDesc: string;
  color: string;
  indicators: string[];
  category: StrategyCategory;
  difficulty: Difficulty;
  winRateEst: number;  // estimated typical win rate %
  bestFor: string;
}

export const STRATEGY_META: Record<StrategyKey, StrategyMeta> = {
  // Trend Following
  ema_cross:      { name: 'EMA Crossover',        shortDesc: 'EMA 9/21 crossover momentum',        color: '#3B82F6', indicators: ['EMA9','EMA21'],              category: 'trend',         difficulty: 'beginner',      winRateEst: 72, bestFor: 'Trending markets' },
  trend_pullback: { name: 'Trend Pullback',        shortDesc: 'Pullback to EMA21 in trend',         color: '#2563EB', indicators: ['EMA9','EMA21','EMA50'],       category: 'trend',         difficulty: 'intermediate',  winRateEst: 68, bestFor: 'Strong trends' },
  supertrend:     { name: 'Supertrend',            shortDesc: 'ATR-based trend filter signal',      color: '#1D4ED8', indicators: ['EMA21','ATR'],               category: 'trend',         difficulty: 'beginner',      winRateEst: 65, bestFor: 'Volatile markets' },
  ma_ribbon:      { name: 'MA Ribbon',             shortDesc: 'All EMAs aligned momentum',          color: '#1E40AF', indicators: ['EMA9','EMA21','EMA50'],       category: 'trend',         difficulty: 'intermediate',  winRateEst: 70, bestFor: 'Strong momentum' },

  // Reversal
  rsi_divergence: { name: 'RSI Divergence',        shortDesc: 'Price-RSI divergence reversal',      color: '#8B5CF6', indicators: ['RSI'],                       category: 'reversal',      difficulty: 'advanced',      winRateEst: 67, bestFor: 'Exhausted trends' },
  double_bottom:  { name: 'Double Bottom/Top',     shortDesc: 'W/M pattern at key levels',          color: '#7C3AED', indicators: ['RSI','Price'],               category: 'reversal',      difficulty: 'intermediate',  winRateEst: 65, bestFor: 'Range boundaries' },
  head_shoulders: { name: 'Head & Shoulders',      shortDesc: 'Classic 3-peak reversal pattern',    color: '#6D28D9', indicators: ['Price','Volume'],            category: 'reversal',      difficulty: 'advanced',      winRateEst: 63, bestFor: 'Top/bottom reversal' },
  pin_bar:        { name: 'Pin Bar',               shortDesc: 'Long wick rejection candle',         color: '#5B21B6', indicators: ['Price','RSI'],               category: 'reversal',      difficulty: 'beginner',      winRateEst: 66, bestFor: 'Key price levels' },
  engulfing:      { name: 'Engulfing Candle',      shortDesc: 'Momentum reversal candle',           color: '#4C1D95', indicators: ['Price','RSI'],               category: 'reversal',      difficulty: 'beginner',      winRateEst: 64, bestFor: 'Reversal zones' },

  // Breakout
  bb_squeeze:     { name: 'BB Squeeze',            shortDesc: 'Bollinger Band breakout',            color: '#A855F7', indicators: ['BB','EMA','MACD'],           category: 'breakout',      difficulty: 'intermediate',  winRateEst: 65, bestFor: 'Low volatility periods' },
  donchian:       { name: 'Donchian Channel',      shortDesc: '20-period high/low breakout',        color: '#9333EA', indicators: ['Donchian','RSI'],            category: 'breakout',      difficulty: 'beginner',      winRateEst: 62, bestFor: 'Trending breakouts' },
  orb:            { name: 'Opening Range Break',   shortDesc: 'Open range breakout entry',          color: '#7E22CE', indicators: ['Price','RSI'],               category: 'breakout',      difficulty: 'intermediate',  winRateEst: 60, bestFor: 'Market open sessions' },

  // Institutional / Smart Money
  order_block:    { name: 'Order Block',           shortDesc: 'Institutional order zone re-test',   color: '#F59E0B', indicators: ['Price','EMA'],              category: 'institutional', difficulty: 'advanced',      winRateEst: 70, bestFor: 'Institutional levels' },
  liquidity_grab: { name: 'Liquidity Grab',        shortDesc: 'Stop hunt reversal signal',          color: '#D97706', indicators: ['Price','RSI'],               category: 'institutional', difficulty: 'advanced',      winRateEst: 68, bestFor: 'High-liquidity zones' },
  fvg:            { name: 'Fair Value Gap',        shortDesc: 'Imbalance fill trade',               color: '#B45309', indicators: ['Price'],                     category: 'institutional', difficulty: 'advanced',      winRateEst: 66, bestFor: 'Gap fills' },
  structure_break:{ name: 'Structure Break',       shortDesc: 'Market structure break + retest',    color: '#92400E', indicators: ['Price','EMA'],              category: 'institutional', difficulty: 'advanced',      winRateEst: 69, bestFor: 'Trend changes' },

  // Momentum
  macd_cross:     { name: 'MACD Cross',            shortDesc: 'MACD signal line crossover',         color: '#10B981', indicators: ['MACD','EMA'],               category: 'momentum',      difficulty: 'beginner',      winRateEst: 66, bestFor: 'Momentum moves' },
  stoch_rsi:      { name: 'Stochastic RSI',        shortDesc: 'Stoch RSI crossover signal',         color: '#059669', indicators: ['StochRSI','RSI'],            category: 'momentum',      difficulty: 'intermediate',  winRateEst: 64, bestFor: 'Short-term momentum' },
  vpa:            { name: 'Volume Price Analysis', shortDesc: 'Strong candle with high volume',     color: '#047857', indicators: ['Volume','RSI'],              category: 'momentum',      difficulty: 'intermediate',  winRateEst: 67, bestFor: 'Volume-driven markets' },

  // Range / Mean Reversion
  rsi_reversal:   { name: 'RSI Reversal',          shortDesc: 'Oversold/Overbought bounce',         color: '#EF4444', indicators: ['RSI','BB'],                  category: 'range',         difficulty: 'beginner',      winRateEst: 68, bestFor: 'Range-bound markets' },
  keltner:        { name: 'Keltner Reversion',     shortDesc: 'Keltner Channel mean reversion',     color: '#DC2626', indicators: ['EMA21','ATR'],              category: 'range',         difficulty: 'intermediate',  winRateEst: 63, bestFor: 'Mean reverting assets' },

  // News
  news_trade:     { name: 'News Trade',            shortDesc: 'High-impact news spike entry',       color: '#F97316', indicators: ['ATR','Price'],              category: 'news',          difficulty: 'advanced',      winRateEst: 58, bestFor: 'News events' },
  news_confluence:{ name: 'News Confluence',       shortDesc: 'News + trend direction trade',       color: '#EA580C', indicators: ['ATR','EMA','RSI'],           category: 'news',          difficulty: 'advanced',      winRateEst: 61, bestFor: 'News with trend' },

  // Multi-Timeframe
  mtf_analysis:   { name: 'MTF Analysis',          shortDesc: 'Top-down multi-timeframe entry',     color: '#06B6D4', indicators: ['EMA9','EMA21','EMA50'],      category: 'mtf',           difficulty: 'advanced',      winRateEst: 72, bestFor: 'High-probability setups' },
  weekly_level:   { name: 'Weekly Level + Daily',  shortDesc: 'Weekly S/R + daily signal entry',    color: '#0891B2', indicators: ['EMA200','EMA21','RSI'],      category: 'mtf',           difficulty: 'advanced',      winRateEst: 70, bestFor: 'Major key levels' },
};

export const CATEGORY_META: Record<StrategyCategory, { label: string; color: string }> = {
  trend:         { label: 'Trend Following',  color: '#3B82F6' },
  reversal:      { label: 'Reversal',         color: '#8B5CF6' },
  breakout:      { label: 'Breakout',         color: '#A855F7' },
  institutional: { label: 'Institutional',    color: '#F59E0B' },
  momentum:      { label: 'Momentum',         color: '#10B981' },
  range:         { label: 'Mean Reversion',   color: '#EF4444' },
  news:          { label: 'News',             color: '#F97316' },
  mtf:           { label: 'Multi-Timeframe',  color: '#06B6D4' },
};
