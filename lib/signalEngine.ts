import { RSI, EMA, MACD, BollingerBands, ADX, ATR } from 'technicalindicators';

export interface OHLCV {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface SignalResult {
  signal: 'BUY' | 'SELL' | 'WAIT';
  confidence: number;
  reasons: string[];
  indicators: {
    rsi: number;
    ema9: number;
    ema21: number;
    macd: number | undefined;
    macdSignal: number | undefined;
    bb: { upper: number; middle: number; lower: number } | undefined;
    adx: number | undefined;
    atr: number | undefined;
    trending: boolean;
  };
  conditions: {
    rsi: boolean;
    ema: boolean;
    macd: boolean;
    vol: boolean;
    bb: boolean;
  };
}

export const SAFETY_RULES = {
  minConditionsRequired: 2,
  avoidNewsWindowMinutes: 30,
  requireLeverageConfirmation: true,
  avoidLowLiquiditySessions: true,
  maxSuggestedLeverage: 10,
  minConfidenceScore: 25,
  requireStopLoss: true,
};

export function calculateSignal(ohlcv: OHLCV[]): SignalResult {
  if (ohlcv.length < 30) {
    return {
      signal: 'WAIT',
      confidence: 0,
      reasons: ['Insufficient data for signal calculation.'],
      indicators: { rsi: 50, ema9: 0, ema21: 0, macd: undefined, macdSignal: undefined, bb: undefined, adx: undefined, atr: undefined, trending: false },
      conditions: { rsi: false, ema: false, macd: false, vol: false, bb: false },
    };
  }

  const closes = ohlcv.map(c => c.close);
  const highs  = ohlcv.map(c => c.high);
  const lows   = ohlcv.map(c => c.low);
  const vols   = ohlcv.map(c => c.volume);

  const rsiValues   = RSI.calculate({ values: closes, period: 14 });
  const ema9Values  = EMA.calculate({ values: closes, period: 9 });
  const ema21Values = EMA.calculate({ values: closes, period: 21 });
  const macdResult  = MACD.calculate({ values: closes, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9, SimpleMAOscillator: false, SimpleMASignal: false });
  const bbResult    = BollingerBands.calculate({ values: closes, period: 20, stdDev: 2 });
  const adxResult   = ADX.calculate({ high: highs, low: lows, close: closes, period: 14 });
  const atrResult   = ATR.calculate({ high: highs, low: lows, close: closes, period: 14 });

  const rsi      = rsiValues.at(-1) ?? 50;
  const ema9     = ema9Values.at(-1) ?? 0;
  const ema21    = ema21Values.at(-1) ?? 0;
  const ema9prev = ema9Values.at(-2) ?? 0;
  const ema21prev= ema21Values.at(-2) ?? 0;
  const macd     = macdResult.at(-1);
  const macdPrev = macdResult.at(-2);
  const bb       = bbResult.at(-1);
  const adx      = adxResult.at(-1);
  const atr      = atrResult.at(-1);
  const lastClose= closes.at(-1) ?? 0;

  const avgVolume  = vols.slice(-20).reduce((a, b) => a + b, 0) / 20;
  const lastVolume = vols.at(-1) ?? 0;
  const hasVolumeData = avgVolume > 0 || lastVolume > 0;

  const emaCrossedBullish = ema9prev < ema21prev && ema9 > ema21;
  const emaCrossedBearish = ema9prev > ema21prev && ema9 < ema21;
  // Also check if EMA9 is above/below EMA21 (trend alignment, not just crossover)
  const ema9AboveEma21 = ema9 > ema21;
  const ema9BelowEma21 = ema9 < ema21;
  const macdBullCross = !!(macdPrev?.MACD && macdPrev?.signal && macd?.MACD && macd?.signal && macdPrev.MACD < macdPrev.signal && macd.MACD > macd.signal);
  const macdBearCross = !!(macdPrev?.MACD && macdPrev?.signal && macd?.MACD && macd?.signal && macdPrev.MACD > macdPrev.signal && macd.MACD < macd.signal);
  // Also check MACD histogram direction when no crossover
  const macdBullish = !!(macd?.MACD && macd?.signal && macd.MACD > macd.signal);
  const macdBearish = !!(macd?.MACD && macd?.signal && macd.MACD < macd.signal);
  const volumeSpike  = hasVolumeData ? lastVolume > avgVolume * 1.3 : false;
  const nearLowerBB  = bb ? lastClose <= bb.lower * 1.005 : false;
  const nearUpperBB  = bb ? lastClose >= bb.upper * 0.995 : false;
  const trending     = (adx?.adx ?? 0) > 25;

  // Core conditions (always scored)
  // RSI thresholds: 45/55 instead of 35/65 for more crypto-friendly signals
  const coreBuyConditions  = [rsi < 45, emaCrossedBullish || ema9AboveEma21, macdBullCross || macdBullish, nearLowerBB];
  const coreSellConditions = [rsi > 55, emaCrossedBearish || ema9BelowEma21, macdBearCross || macdBearish, nearUpperBB];

  // Volume condition added only when volume data is available
  const buyConditions  = hasVolumeData ? [...coreBuyConditions,  volumeSpike] : coreBuyConditions;
  const sellConditions = hasVolumeData ? [...coreSellConditions, volumeSpike] : coreSellConditions;

  const buyCount  = buyConditions.filter(Boolean).length;
  const sellCount = sellConditions.filter(Boolean).length;

  let signal: 'BUY' | 'SELL' | 'WAIT' = 'WAIT';
  let confidence = 0;
  const reasons: string[] = [];

  if (buyCount >= SAFETY_RULES.minConditionsRequired && buyCount > sellCount) {
    signal = 'BUY';
    confidence = Math.round((buyCount / buyConditions.length) * 100);
    if (rsi < 45)          reasons.push(`RSI at ${rsi.toFixed(1)} — oversold, bounce likely`);
    if (emaCrossedBullish) reasons.push('EMA 9 crossed above EMA 21 — bullish momentum');
    if (macdBullCross)     reasons.push('MACD bullish crossover confirmed');
    if (nearLowerBB)       reasons.push('Price at lower Bollinger Band — support zone');
    if (volumeSpike)       reasons.push('Volume spike — strong buying interest');
  } else if (sellCount >= SAFETY_RULES.minConditionsRequired && sellCount > buyCount) {
    signal = 'SELL';
    confidence = Math.round((sellCount / sellConditions.length) * 100);
    if (rsi > 55)          reasons.push(`RSI at ${rsi.toFixed(1)} — overbought, pullback likely`);
    if (emaCrossedBearish) reasons.push('EMA 9 crossed below EMA 21 — bearish momentum');
    if (macdBearCross)     reasons.push('MACD bearish crossover confirmed');
    if (nearUpperBB)       reasons.push('Price at upper Bollinger Band — resistance zone');
    if (volumeSpike)       reasons.push('Volume spike — strong selling interest');
  } else {
    reasons.push('No clear signal — conditions not aligned. Wait for better setup.');
  }

  if (confidence < SAFETY_RULES.minConfidenceScore && signal !== 'WAIT') {
    signal = 'WAIT';
    confidence = 0;
    reasons.length = 0;
    reasons.push('Signal confidence below minimum threshold. Wait for stronger setup.');
  }

  return {
    signal,
    confidence,
    reasons,
    indicators: { rsi, ema9, ema21, macd: macd?.MACD, macdSignal: macd?.signal, bb: bb ? { upper: bb.upper, middle: bb.middle, lower: bb.lower } : undefined, adx: adx?.adx, atr, trending },
    conditions: {
      rsi:  signal === 'BUY' ? rsi < 45 : rsi > 55,
      ema:  signal === 'BUY' ? (emaCrossedBullish || ema9AboveEma21) : (emaCrossedBearish || ema9BelowEma21),
      macd: signal === 'BUY' ? (macdBullCross || macdBullish) : (macdBearCross || macdBearish),
      vol:  hasVolumeData ? volumeSpike : false,
      bb:   signal === 'BUY' ? nearLowerBB : nearUpperBB,
    },
  };
}
