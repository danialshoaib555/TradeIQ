import type { SignalResult } from './signalEngine';

export interface Strategy {
  key: string;
  name: string;
  winRate: number;
  profitFactor: number;
  avgGain: number;
  bestFor: string;
  bestSessions: string;
  when: string;
  chipLabel: string;
  explanation: string;
  conditionLabels: string[];
  matchScore: number;
}

type IndicatorInput = SignalResult['indicators'] & { conditions: SignalResult['conditions'] };

const STRATEGY_SCORERS: Record<string, { meta: Omit<Strategy, 'key' | 'matchScore'>; score: (ind: IndicatorInput) => number }> = {
  ema_cross: {
    meta: {
      name: 'EMA Crossover', winRate: 72, profitFactor: 2.1, avgGain: 1.8,
      bestFor: 'Trending markets', bestSessions: 'London + New York overlap (13:00–17:00 UTC)',
      when: 'When the market has been trending for 2+ hours in one direction', chipLabel: 'EMA cross',
      explanation: 'When EMA 9 crosses above EMA 21, short-term momentum has turned bullish. One of the most reliable strategies for pairs that trend well.',
      conditionLabels: ['RSI not extreme (35–65)', 'EMA 9 crossed EMA 21', 'Price above EMA 21', 'Volume above average'],
    },
    score: (ind) => {
      let s = 0;
      if (ind.rsi > 35 && ind.rsi < 65) s += 25;
      if (ind.conditions.ema)            s += 35;
      if (ind.ema9 > ind.ema21)          s += 25;
      if (ind.conditions.vol)            s += 15;
      return s;
    },
  },
  rsi_reversal: {
    meta: {
      name: 'RSI Reversal', winRate: 68, profitFactor: 1.9, avgGain: 1.5,
      bestFor: 'Range-bound markets', bestSessions: 'Tokyo session (00:00–09:00 UTC)',
      when: 'When the market has been moving in one direction for 3+ hours without a break', chipLabel: 'RSI reversal',
      explanation: 'RSI below 30 means sellers are exhausted — a bounce is likely. RSI above 70 means buyers are exhausted — a pullback is likely.',
      conditionLabels: ['RSI below 30 or above 70', 'Price near support/resistance', 'No strong trend (ADX < 25)', 'Long wick reversal candle'],
    },
    score: (ind) => {
      let s = 0;
      if (ind.rsi < 32 || ind.rsi > 68) s += 40;
      if (!ind.trending)                 s += 25;
      if (ind.conditions.rsi)            s += 25;
      if (ind.conditions.vol)            s += 10;
      return s;
    },
  },
  bb_squeeze: {
    meta: {
      name: 'Bollinger Band Squeeze', winRate: 65, profitFactor: 2.4, avgGain: 2.2,
      bestFor: 'Pre-breakout setups', bestSessions: 'Any — especially before major news events',
      when: 'After a long period of low volatility — big move is building up', chipLabel: 'BB squeeze',
      explanation: 'When Bollinger Bands squeeze tight, a big move is coming. Trade the breakout direction with larger TP targets.',
      conditionLabels: ['BB bands very narrow', 'Price consolidating 5+ candles', 'Volume dropping (energy building)', 'MACD showing divergence'],
    },
    score: (ind) => {
      let s = 0;
      if (ind.bb && (ind.bb.upper - ind.bb.lower) < ind.bb.middle * 0.02) s += 40;
      if (!ind.conditions.vol)   s += 20;
      if (ind.conditions.macd)   s += 25;
      if (!ind.trending)         s += 15;
      return s;
    },
  },
  sr_bounce: {
    meta: {
      name: 'Support & Resistance', winRate: 70, profitFactor: 1.8, avgGain: 1.4,
      bestFor: 'Key price levels', bestSessions: 'Any session — works in all markets',
      when: 'When price returns to a level it has bounced from before', chipLabel: 'S&R bounce',
      explanation: 'Price bounces from the same levels repeatedly. Buy at tested support, sell at tested resistance.',
      conditionLabels: ['Price at key level', 'RSI confirming (oversold at support)', 'Higher timeframe agrees', 'Previous bounce from same level'],
    },
    score: (ind) => {
      let s = 0;
      if (ind.conditions.rsi)  s += 35;
      if (ind.conditions.ema)  s += 25;
      if (ind.conditions.macd) s += 25;
      if (ind.conditions.vol)  s += 15;
      return s;
    },
  },
  macd_cross: {
    meta: {
      name: 'MACD Crossover', winRate: 66, profitFactor: 2.3, avgGain: 2.0,
      bestFor: 'Momentum moves', bestSessions: 'New York session (13:00–22:00 UTC)',
      when: 'Use on 4h or daily chart for swing trades lasting 1–5 days', chipLabel: 'MACD cross',
      explanation: 'MACD line crossing above signal line means momentum is shifting bullish. Powerful on higher timeframes.',
      conditionLabels: ['MACD crossed above signal line', 'Histogram turning positive', 'Crossover below zero (strongest)', 'EMA 21 pointing upward'],
    },
    score: (ind) => {
      let s = 0;
      if (ind.conditions.macd)  s += 40;
      if ((ind.macd ?? 0) < 0)  s += 20;
      if (ind.trending)         s += 25;
      if (ind.ema9 > ind.ema21) s += 15;
      return s;
    },
  },
};

export function getBestStrategy(signalResult: SignalResult): { best: Strategy; ranked: Strategy[]; hasValidSignal: boolean } {
  const ind: IndicatorInput = { ...signalResult.indicators, conditions: signalResult.conditions };
  const scored: Strategy[] = Object.entries(STRATEGY_SCORERS).map(([key, { meta, score }]) => ({
    key, ...meta, matchScore: score(ind),
  })).sort((a, b) => b.matchScore - a.matchScore);
  return { best: scored[0], ranked: scored, hasValidSignal: scored[0].matchScore >= 55 };
}
