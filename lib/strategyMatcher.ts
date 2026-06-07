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
  category: string;
  difficulty: string;
}

type IndicatorInput = SignalResult['indicators'] & { conditions: SignalResult['conditions'] };

const STRATEGY_SCORERS: Record<string, { meta: Omit<Strategy, 'key' | 'matchScore'>; score: (ind: IndicatorInput) => number }> = {
  // ── Trend Following ───────────────────────────────────────────────────────
  ema_cross: {
    meta: {
      name: 'EMA Crossover', winRate: 72, profitFactor: 2.1, avgGain: 1.8,
      bestFor: 'Trending markets', bestSessions: 'London + New York overlap (13:00–17:00 UTC)',
      when: 'When the market has been trending for 2+ hours in one direction', chipLabel: 'EMA Cross',
      explanation: 'When EMA 9 crosses above EMA 21, short-term momentum has turned bullish. One of the most reliable strategies for trending pairs.',
      conditionLabels: ['RSI not extreme (35–65)', 'EMA 9 crossed EMA 21', 'Price above EMA 21', 'Volume above average'],
      category: 'trend', difficulty: 'beginner',
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
  trend_pullback: {
    meta: {
      name: 'Trend Pullback', winRate: 68, profitFactor: 2.0, avgGain: 1.7,
      bestFor: 'Strong trending markets', bestSessions: 'London (08:00–12:00 UTC) · New York (13:00–18:00 UTC)',
      when: 'When price pulls back to EMA21 in a confirmed uptrend or downtrend', chipLabel: 'Pullback',
      explanation: 'In a strong trend, price pulls back to EMA21 offering a lower-risk entry in the direction of the trend.',
      conditionLabels: ['EMA 9 > EMA 21 > EMA 50 (uptrend)', 'Price near EMA21', 'RSI 40–60 (pullback zone)', 'MACD showing momentum'],
      category: 'trend', difficulty: 'intermediate',
    },
    score: (ind) => {
      let s = 0;
      if (ind.conditions.ema)             s += 30;
      if (ind.ema9 > ind.ema21)           s += 20;
      if (ind.rsi > 40 && ind.rsi < 60)  s += 30;
      if (ind.conditions.macd)            s += 20;
      return s;
    },
  },
  supertrend: {
    meta: {
      name: 'Supertrend', winRate: 65, profitFactor: 1.9, avgGain: 1.6,
      bestFor: 'Volatile trending markets', bestSessions: 'Any session',
      when: 'When ATR is high and price breaks above/below the Supertrend line', chipLabel: 'Supertrend',
      explanation: 'The Supertrend indicator uses ATR to define dynamic support/resistance. Crossing it signals a trend change.',
      conditionLabels: ['Price breaks Supertrend line', 'ATR confirming volatility', 'RSI aligned with direction', 'Volume on breakout'],
      category: 'trend', difficulty: 'beginner',
    },
    score: (ind) => {
      let s = 0;
      if (ind.atr && ind.atr > 0)        s += 25;
      if (ind.conditions.ema)            s += 25;
      if (ind.rsi > 50)                  s += 25;
      if (ind.conditions.vol)            s += 25;
      return s;
    },
  },
  ma_ribbon: {
    meta: {
      name: 'MA Ribbon', winRate: 70, profitFactor: 2.2, avgGain: 1.9,
      bestFor: 'Strong momentum moves', bestSessions: 'Any trending session',
      when: 'When all EMAs are aligned in one direction with expanding separation', chipLabel: 'MA Ribbon',
      explanation: 'When EMA 9, 21, and 50 are all stacked in the same direction, momentum is strong. Enter when a new candle confirms the ribbon direction.',
      conditionLabels: ['EMA 9 > 21 > 50 aligned', 'RSI 50–75 (momentum zone)', 'Price above all EMAs', 'No divergence'],
      category: 'trend', difficulty: 'intermediate',
    },
    score: (ind) => {
      let s = 0;
      if (ind.conditions.ema)            s += 30;
      if (ind.ema9 > ind.ema21)          s += 20;
      if (ind.rsi > 50 && ind.rsi < 75) s += 30;
      if (ind.trending)                  s += 20;
      return s;
    },
  },

  // ── Reversal ──────────────────────────────────────────────────────────────
  rsi_divergence: {
    meta: {
      name: 'RSI Divergence', winRate: 67, profitFactor: 2.0, avgGain: 1.8,
      bestFor: 'Exhausted trending markets', bestSessions: 'Any — works on all timeframes',
      when: 'When price makes a new high/low but RSI fails to follow', chipLabel: 'RSI Div',
      explanation: 'RSI divergence warns that momentum is fading before price reverses. One of the most powerful early-warning signals.',
      conditionLabels: ['Price new high but RSI lower high', 'RSI in extreme zone (>65 or <35)', 'Previous swing visible', 'EMA convergence'],
      category: 'reversal', difficulty: 'advanced',
    },
    score: (ind) => {
      let s = 0;
      if (ind.rsi < 35 || ind.rsi > 65)  s += 40;
      if (!ind.trending)                   s += 20;
      if (ind.conditions.rsi)              s += 30;
      if (ind.conditions.bb)               s += 10;
      return s;
    },
  },
  double_bottom: {
    meta: {
      name: 'Double Bottom / Top', winRate: 65, profitFactor: 1.9, avgGain: 1.7,
      bestFor: 'Range boundaries', bestSessions: 'London and New York sessions',
      when: 'When price tests a key level twice and fails to break through', chipLabel: 'Double Bot/Top',
      explanation: 'Two touches of the same support or resistance level with RSI recovery signals a reversal. The second touch is the entry.',
      conditionLabels: ['Two price touches at same level', 'RSI recovery on second touch', 'Volume decreasing into support', 'Neckline break confirmation'],
      category: 'reversal', difficulty: 'intermediate',
    },
    score: (ind) => {
      let s = 0;
      if (ind.rsi < 40 || ind.rsi > 60) s += 35;
      if (!ind.trending)                 s += 25;
      if (ind.conditions.rsi)            s += 25;
      if (ind.conditions.vol)            s += 15;
      return s;
    },
  },
  head_shoulders: {
    meta: {
      name: 'Head & Shoulders', winRate: 63, profitFactor: 2.3, avgGain: 2.1,
      bestFor: 'Major trend reversals', bestSessions: 'Any — best on 4h and daily charts',
      when: 'After a prolonged trend, when the third peak is lower than the middle (head)', chipLabel: 'H&S',
      explanation: 'The classic 3-peak reversal pattern. Head is highest, two shoulders are lower. Neckline break confirms reversal.',
      conditionLabels: ['3-peak pattern visible', 'Head higher than shoulders', 'Neckline identified', 'Volume declining into right shoulder'],
      category: 'reversal', difficulty: 'advanced',
    },
    score: (ind) => {
      let s = 0;
      if (!ind.trending)                  s += 30;
      if (ind.rsi < 45 || ind.rsi > 55) s += 25;
      if (ind.conditions.macd)            s += 25;
      if (ind.conditions.vol)             s += 20;
      return s;
    },
  },
  pin_bar: {
    meta: {
      name: 'Pin Bar', winRate: 66, profitFactor: 1.8, avgGain: 1.5,
      bestFor: 'Key price level rejections', bestSessions: 'Any session — all timeframes',
      when: 'When a candle forms a long wick at support or resistance', chipLabel: 'Pin Bar',
      explanation: 'A pin bar has a long wick showing price rejection. The wick side shows where the market rejected — trade in the opposite direction.',
      conditionLabels: ['Long wick (>2x body)', 'At key S/R level', 'RSI confirming exhaustion', 'Next candle confirms direction'],
      category: 'reversal', difficulty: 'beginner',
    },
    score: (ind) => {
      let s = 0;
      if (ind.rsi < 40 || ind.rsi > 60) s += 35;
      if (ind.conditions.rsi)             s += 30;
      if (ind.conditions.bb)              s += 20;
      if (!ind.trending)                  s += 15;
      return s;
    },
  },
  engulfing: {
    meta: {
      name: 'Engulfing Candle', winRate: 64, profitFactor: 1.7, avgGain: 1.4,
      bestFor: 'Reversal zones', bestSessions: 'Any session',
      when: 'When a large candle completely engulfs the previous candle at a key level', chipLabel: 'Engulfing',
      explanation: 'A bullish engulfing candle shows buyers overwhelmed sellers in one session — a strong short-term reversal signal.',
      conditionLabels: ['Current candle engulfs previous', 'At key S/R level or EMA', 'RSI not extreme in trend direction', 'Volume above average'],
      category: 'reversal', difficulty: 'beginner',
    },
    score: (ind) => {
      let s = 0;
      if (ind.rsi < 45 || ind.rsi > 55) s += 30;
      if (ind.conditions.vol)             s += 30;
      if (ind.conditions.rsi)             s += 25;
      if (!ind.trending)                  s += 15;
      return s;
    },
  },

  // ── Breakout ──────────────────────────────────────────────────────────────
  bb_squeeze: {
    meta: {
      name: 'Bollinger Band Squeeze', winRate: 65, profitFactor: 2.4, avgGain: 2.2,
      bestFor: 'Pre-breakout setups', bestSessions: 'Any — especially before major news events',
      when: 'After a long period of low volatility — big move is building up', chipLabel: 'BB Squeeze',
      explanation: 'When Bollinger Bands squeeze tight, a big move is coming. Trade the breakout direction with larger TP targets.',
      conditionLabels: ['BB bands very narrow (<2% of price)', 'Price consolidating 5+ candles', 'Volume dropping (energy building)', 'MACD showing divergence'],
      category: 'breakout', difficulty: 'intermediate',
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
  donchian: {
    meta: {
      name: 'Donchian Channel', winRate: 62, profitFactor: 1.8, avgGain: 1.7,
      bestFor: 'Trending breakouts', bestSessions: 'Any session',
      when: 'When price breaks the 20-period high or low for the first time in the range', chipLabel: 'Donchian',
      explanation: 'The Donchian channel tracks the highest high and lowest low over 20 periods. Breaking either level signals a potential new trend.',
      conditionLabels: ['Price breaks 20-period high/low', 'RSI 50–75 (bullish breakout)', 'No immediate reversal', 'Volume spike on breakout'],
      category: 'breakout', difficulty: 'beginner',
    },
    score: (ind) => {
      let s = 0;
      if (ind.rsi > 50 && ind.rsi < 75)  s += 30;
      if (ind.conditions.vol)              s += 30;
      if (ind.conditions.ema)              s += 25;
      if (ind.trending)                    s += 15;
      return s;
    },
  },
  orb: {
    meta: {
      name: 'Opening Range Breakout', winRate: 60, profitFactor: 1.9, avgGain: 1.8,
      bestFor: 'Market open sessions', bestSessions: 'First 30–60 min of London/New York open',
      when: 'When price breaks above or below the first 3 candles of the session', chipLabel: 'ORB',
      explanation: 'The opening range captures the initial battle between buyers and sellers. A clean break above/below it signals strong directional intent.',
      conditionLabels: ['Opening range defined (first 3 candles)', 'Clean break above/below range', 'RSI momentum confirming', 'Not near major S/R'],
      category: 'breakout', difficulty: 'intermediate',
    },
    score: (ind) => {
      let s = 0;
      if (ind.rsi > 48 && ind.rsi < 72)  s += 35;
      if (ind.conditions.vol)              s += 30;
      if (ind.conditions.ema)              s += 20;
      if (ind.conditions.macd)             s += 15;
      return s;
    },
  },

  // ── Institutional / Smart Money ───────────────────────────────────────────
  order_block: {
    meta: {
      name: 'Order Block', winRate: 70, profitFactor: 2.5, avgGain: 2.0,
      bestFor: 'Institutional price zones', bestSessions: 'London and New York sessions',
      when: 'When price returns to a strong impulse candle origin (order block zone)', chipLabel: 'Order Block',
      explanation: 'Large institutions leave orders at specific price zones. When price returns to these zones, institutions re-enter — creating high-probability setups.',
      conditionLabels: ['Strong impulse candle identified', 'Price returns to candle origin', 'RSI not overbought/oversold', 'Higher TF order block alignment'],
      category: 'institutional', difficulty: 'advanced',
    },
    score: (ind) => {
      let s = 0;
      if (ind.conditions.ema)             s += 30;
      if (ind.rsi > 40 && ind.rsi < 60) s += 30;
      if (ind.conditions.macd)            s += 25;
      if (ind.conditions.vol)             s += 15;
      return s;
    },
  },
  liquidity_grab: {
    meta: {
      name: 'Liquidity Grab', winRate: 68, profitFactor: 2.3, avgGain: 2.1,
      bestFor: 'Stop-hunt reversal zones', bestSessions: 'New York + London overlap',
      when: 'When price spikes below a key low (or above a key high) and immediately reverses', chipLabel: 'Liq. Grab',
      explanation: 'Smart money grabs retail stop losses below key lows, then reverses hard. The sharp wick followed by a reversal is the signal.',
      conditionLabels: ['Price sweeps below/above key level', 'Immediate reversal close', 'RSI divergence on sweep', 'High volume on the wick'],
      category: 'institutional', difficulty: 'advanced',
    },
    score: (ind) => {
      let s = 0;
      if (ind.rsi < 35 || ind.rsi > 65) s += 40;
      if (ind.conditions.rsi)             s += 25;
      if (ind.conditions.vol)             s += 20;
      if (!ind.trending)                  s += 15;
      return s;
    },
  },
  fvg: {
    meta: {
      name: 'Fair Value Gap', winRate: 66, profitFactor: 2.1, avgGain: 1.9,
      bestFor: 'Price imbalance fills', bestSessions: 'Any session with momentum candles',
      when: 'When a 3-candle sequence leaves a gap (candle 1 high < candle 3 low)', chipLabel: 'FVG',
      explanation: 'A Fair Value Gap is a price imbalance where the market moved too fast. Price often returns to fill this gap before continuing in the original direction.',
      conditionLabels: ['3-candle gap visible', 'Price returns to gap zone', 'RSI neutral (40–60)', 'Trend direction confirmed'],
      category: 'institutional', difficulty: 'advanced',
    },
    score: (ind) => {
      let s = 0;
      if (ind.rsi > 40 && ind.rsi < 60) s += 35;
      if (ind.conditions.ema)             s += 30;
      if (ind.conditions.macd)            s += 20;
      if (ind.conditions.vol)             s += 15;
      return s;
    },
  },
  structure_break: {
    meta: {
      name: 'Market Structure Break', winRate: 69, profitFactor: 2.4, avgGain: 2.0,
      bestFor: 'Trend changes', bestSessions: 'Any session',
      when: 'When price breaks above the last swing high (in a downtrend) or below swing low (in uptrend)', chipLabel: 'BOS',
      explanation: 'Breaking market structure signals a potential trend change. The Break of Structure (BOS) followed by a retest is a high-confidence entry.',
      conditionLabels: ['Swing high/low identified', 'Clean break of structure', 'RSI aligned with break direction', 'Pullback to broken level'],
      category: 'institutional', difficulty: 'advanced',
    },
    score: (ind) => {
      let s = 0;
      if (ind.conditions.ema)            s += 30;
      if (ind.trending)                   s += 25;
      if (ind.conditions.macd)            s += 25;
      if (ind.conditions.vol)             s += 20;
      return s;
    },
  },

  // ── Momentum ──────────────────────────────────────────────────────────────
  macd_cross: {
    meta: {
      name: 'MACD Crossover', winRate: 66, profitFactor: 2.3, avgGain: 2.0,
      bestFor: 'Momentum moves', bestSessions: 'New York session (13:00–22:00 UTC)',
      when: 'Use on 4h or daily chart for swing trades lasting 1–5 days', chipLabel: 'MACD Cross',
      explanation: 'MACD line crossing above signal line means momentum is shifting bullish. Powerful on higher timeframes.',
      conditionLabels: ['MACD crossed above signal line', 'Histogram turning positive', 'Crossover below zero (strongest)', 'EMA 21 pointing upward'],
      category: 'momentum', difficulty: 'beginner',
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
  stoch_rsi: {
    meta: {
      name: 'Stochastic RSI', winRate: 64, profitFactor: 1.8, avgGain: 1.5,
      bestFor: 'Short-term momentum shifts', bestSessions: 'Any session',
      when: 'When Stochastic RSI crosses from oversold (<20) or overbought (>80) zones', chipLabel: 'Stoch RSI',
      explanation: 'Stochastic RSI combines RSI and Stochastic for faster signals. Best for short-term swing trades when crossing from extreme zones.',
      conditionLabels: ['StochRSI below 20 (bullish) or above 80 (bearish)', 'K line crosses D line', 'RSI confirming direction', 'Price at key level'],
      category: 'momentum', difficulty: 'intermediate',
    },
    score: (ind) => {
      let s = 0;
      if (ind.rsi < 35 || ind.rsi > 65)  s += 35;
      if (ind.conditions.rsi)              s += 30;
      if (ind.conditions.macd)             s += 20;
      if (ind.conditions.vol)              s += 15;
      return s;
    },
  },
  vpa: {
    meta: {
      name: 'Volume Price Analysis', winRate: 67, profitFactor: 2.0, avgGain: 1.8,
      bestFor: 'Volume-confirmed moves', bestSessions: 'New York open + London close',
      when: 'When a strong directional candle appears with unusually high volume', chipLabel: 'VPA',
      explanation: 'Volume confirms price moves. A strong bullish candle with >1.5x average volume means institutional participation — the move is real.',
      conditionLabels: ['Volume >1.5x average', 'Strong body candle (>60% of range)', 'RSI in momentum zone', 'Not at major resistance'],
      category: 'momentum', difficulty: 'intermediate',
    },
    score: (ind) => {
      let s = 0;
      if (ind.conditions.vol)            s += 40;
      if (ind.rsi > 45 && ind.rsi < 70) s += 30;
      if (ind.conditions.ema)            s += 20;
      if (ind.trending)                   s += 10;
      return s;
    },
  },

  // ── Range / Mean Reversion ────────────────────────────────────────────────
  rsi_reversal: {
    meta: {
      name: 'RSI Reversal', winRate: 68, profitFactor: 1.9, avgGain: 1.5,
      bestFor: 'Range-bound markets', bestSessions: 'Tokyo session (00:00–09:00 UTC)',
      when: 'When the market has been moving in one direction for 3+ hours without a break', chipLabel: 'RSI Rev',
      explanation: 'RSI below 30 means sellers are exhausted — a bounce is likely. RSI above 70 means buyers are exhausted — a pullback is likely.',
      conditionLabels: ['RSI below 30 or above 70', 'Price near support/resistance', 'No strong trend (ADX < 25)', 'Long wick reversal candle'],
      category: 'range', difficulty: 'beginner',
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
  keltner: {
    meta: {
      name: 'Keltner Reversion', winRate: 63, profitFactor: 1.8, avgGain: 1.5,
      bestFor: 'Mean-reverting assets', bestSessions: 'Tokyo and early London',
      when: 'When price reaches the outer Keltner Channel band with RSI in extreme zone', chipLabel: 'Keltner',
      explanation: 'The Keltner Channel uses ATR around EMA21. Price touching the outer bands with extreme RSI suggests a mean reversion trade.',
      conditionLabels: ['Price at Keltner outer band', 'RSI below 40 (lower band) or above 60 (upper band)', 'EMA21 as target', 'No strong trend'],
      category: 'range', difficulty: 'intermediate',
    },
    score: (ind) => {
      let s = 0;
      if (ind.rsi < 35 || ind.rsi > 65) s += 40;
      if (!ind.trending)                  s += 25;
      if (ind.atr && ind.atr > 0)         s += 20;
      if (ind.conditions.rsi)             s += 15;
      return s;
    },
  },

  // ── News ──────────────────────────────────────────────────────────────────
  news_trade: {
    meta: {
      name: 'High-Impact News Trade', winRate: 58, profitFactor: 2.8, avgGain: 3.0,
      bestFor: 'NFP, CPI, FOMC events', bestSessions: 'New York session news releases',
      when: 'Immediately after a high-impact news release with clear directional price action', chipLabel: 'News Trade',
      explanation: 'High-impact news creates rapid price moves. The initial spike direction (confirmed in first 2 candles post-news) provides a high reward-risk entry.',
      conditionLabels: ['High-impact news released', 'Initial spike direction clear', 'No major S/R immediately ahead', 'ATR spike (2x+ normal)'],
      category: 'news', difficulty: 'advanced',
    },
    score: (ind) => {
      let s = 0;
      if (ind.atr && ind.atr > 0)        s += 30;
      if (ind.conditions.vol)              s += 35;
      if (ind.conditions.macd)             s += 20;
      if (ind.rsi > 50 || ind.rsi < 50) s += 15;
      return s;
    },
  },
  news_confluence: {
    meta: {
      name: 'News + Trend Confluence', winRate: 61, profitFactor: 2.5, avgGain: 2.3,
      bestFor: 'News in direction of trend', bestSessions: 'Any news session',
      when: 'When news release confirms the existing trend direction', chipLabel: 'News Conf.',
      explanation: 'News that aligns with the existing trend creates powerful moves. This strategy only trades when news and trend agree.',
      conditionLabels: ['News in trend direction', 'EMA trend confirmed', 'ATR spike on news', 'RSI not overbought/oversold'],
      category: 'news', difficulty: 'advanced',
    },
    score: (ind) => {
      let s = 0;
      if (ind.conditions.ema)             s += 25;
      if (ind.conditions.vol)              s += 30;
      if (ind.atr && ind.atr > 0)         s += 25;
      if (ind.trending)                    s += 20;
      return s;
    },
  },

  // ── Multi-Timeframe ────────────────────────────────────────────────────────
  mtf_analysis: {
    meta: {
      name: 'Top-Down MTF Analysis', winRate: 72, profitFactor: 2.6, avgGain: 2.2,
      bestFor: 'High-probability setups', bestSessions: 'Any — plan on daily, execute on 4h/1h',
      when: 'When higher and lower timeframes are aligned in the same direction', chipLabel: 'MTF',
      explanation: 'Trade with the higher timeframe trend, enter on the lower timeframe signal. Higher timeframe acts as a filter, lower timeframe provides entry precision.',
      conditionLabels: ['Higher TF trend confirmed (EMA50 bias)', 'Lower TF signal aligned', 'EMA crossover entry', 'RSI in trend zone (50–70 bull)'],
      category: 'mtf', difficulty: 'advanced',
    },
    score: (ind) => {
      let s = 0;
      if (ind.conditions.ema)            s += 30;
      if (ind.trending)                   s += 25;
      if (ind.conditions.macd)            s += 25;
      if (ind.rsi > 50 && ind.rsi < 70) s += 20;
      return s;
    },
  },
  weekly_level: {
    meta: {
      name: 'Weekly Level + Daily Signal', winRate: 70, profitFactor: 2.5, avgGain: 2.3,
      bestFor: 'Major key levels', bestSessions: 'Any — weekly planning + daily execution',
      when: 'When price reaches a weekly support/resistance level and a daily signal fires', chipLabel: 'Weekly Lvl',
      explanation: 'Weekly levels (EMA200 proxy) are the strongest S/R. When daily signals fire at these levels, the probability of a bounce is highest.',
      conditionLabels: ['Price at EMA200 level', 'Daily trend signal confirmed', 'RSI extreme on weekly', 'Multiple TF confluence'],
      category: 'mtf', difficulty: 'advanced',
    },
    score: (ind) => {
      let s = 0;
      if (ind.conditions.rsi)             s += 30;
      if (ind.conditions.ema)             s += 25;
      if (!ind.trending)                  s += 25;
      if (ind.conditions.macd)            s += 20;
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
