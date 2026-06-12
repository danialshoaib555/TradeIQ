// Pre-trade quality scoring — grades a trade setup the way a prop-firm
// risk manager would, before any money is committed.

import type { SignalResult } from './signalEngine';

export interface QualityCheck {
  id: string;
  label: string;
  passed: boolean;
  detail: string;
  weight: number; // contribution to score
}

export interface TradeQuality {
  score: number;        // 0-100
  grade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';
  checks: QualityCheck[];
  verdict: string;
}

interface QualityInput {
  signal: SignalResult | null;
  direction: 'LONG' | 'SHORT';
  rr: number;                  // risk:reward ratio
  riskPctOfBalance: number;    // effective risk as % of total account
  dailyLossPct: number;        // today's realized loss as % of account (positive number)
  consecutiveLosses: number;   // current losing streak today
  sessionQuality?: string;     // 'best' | 'good' | 'moderate' | 'poor'
}

export function scoreTradeQuality(input: QualityInput): TradeQuality {
  const checks: QualityCheck[] = [];
  const signalDir = input.signal?.signal === 'SELL' ? 'SHORT' : 'LONG';
  const hasSignal = !!input.signal && input.signal.signal !== 'WAIT';

  // 1. Signal alignment (25)
  checks.push({
    id: 'alignment',
    label: 'Trading with the signal',
    passed: hasSignal && input.direction === signalDir,
    detail: hasSignal
      ? input.direction === signalDir
        ? `Signal agrees: ${input.signal!.signal} ${input.signal!.confidence}%`
        : `Signal says ${signalDir} — you're going against it`
      : 'No active signal (WAIT) — this is a counter-system trade',
    weight: 25,
  });

  // 2. Signal confidence (15)
  const conf = input.signal?.confidence ?? 0;
  checks.push({
    id: 'confidence',
    label: 'Signal confidence ≥ 40%',
    passed: conf >= 40,
    detail: conf >= 40 ? `Confidence ${conf}%` : `Confidence only ${conf}% — weak setup`,
    weight: 15,
  });

  // 3. Risk:Reward ≥ 1.5 (20)
  checks.push({
    id: 'rr',
    label: 'Risk:Reward at least 1:1.5',
    passed: input.rr >= 1.5,
    detail: input.rr >= 1.5
      ? `R:R is 1:${input.rr.toFixed(1)} — winners outpay losers`
      : `R:R is only 1:${input.rr.toFixed(1)} — you need a high win rate to survive this`,
    weight: 20,
  });

  // 4. Risk per trade ≤ 2% of account (20)
  checks.push({
    id: 'risk',
    label: 'Risking ≤ 2% of account',
    passed: input.riskPctOfBalance <= 2,
    detail: input.riskPctOfBalance <= 2
      ? `Risking ${input.riskPctOfBalance.toFixed(1)}% — sustainable`
      : `Risking ${input.riskPctOfBalance.toFixed(1)}% — one bad streak could wipe you out`,
    weight: 20,
  });

  // 5. Daily loss limit not breached (10)
  checks.push({
    id: 'dailyloss',
    label: 'Within daily loss limit (5%)',
    passed: input.dailyLossPct < 5,
    detail: input.dailyLossPct < 5
      ? input.dailyLossPct > 0
        ? `Down ${input.dailyLossPct.toFixed(1)}% today — still inside the limit`
        : 'No losses today'
      : `Down ${input.dailyLossPct.toFixed(1)}% today — pros stop trading here`,
    weight: 10,
  });

  // 6. Not revenge trading (10)
  checks.push({
    id: 'streak',
    label: 'No revenge trading',
    passed: input.consecutiveLosses < 3,
    detail: input.consecutiveLosses < 3
      ? input.consecutiveLosses > 0
        ? `${input.consecutiveLosses} loss${input.consecutiveLosses > 1 ? 'es' : ''} in a row — stay calm`
        : 'Clean slate'
      : `${input.consecutiveLosses} losses in a row — step away from the screen`,
    weight: 10,
  });

  const score = checks.reduce((s, c) => s + (c.passed ? c.weight : 0), 0);

  const grade: TradeQuality['grade'] =
    score >= 95 ? 'A+' :
    score >= 85 ? 'A'  :
    score >= 70 ? 'B'  :
    score >= 55 ? 'C'  :
    score >= 40 ? 'D'  : 'F';

  const verdict =
    grade === 'A+' || grade === 'A'
      ? 'Professional-grade setup. This is how funded traders trade.'
      : grade === 'B'
        ? 'Decent setup with a flaw — fix the failed check if you can.'
        : grade === 'C'
          ? 'Marginal. Pros would skip this and wait for better.'
          : 'Poor setup. Taking this trade is gambling, not trading.';

  return { score, grade, checks, verdict };
}

// Daily stats helper — derive from demo trade history
export function getDailyStats(trades: { closeTime?: number; pnl: number; status: string }[], balance: number) {
  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
  const todayClosed = trades
    .filter(t => t.status !== 'OPEN' && t.closeTime && t.closeTime >= startOfDay.getTime())
    .sort((a, b) => (a.closeTime ?? 0) - (b.closeTime ?? 0));

  const todayPnl = todayClosed.reduce((s, t) => s + t.pnl, 0);
  const dailyLossPct = todayPnl < 0 ? (Math.abs(todayPnl) / balance) * 100 : 0;

  let consecutiveLosses = 0;
  for (let i = todayClosed.length - 1; i >= 0; i--) {
    if (todayClosed[i].pnl < 0) consecutiveLosses++;
    else break;
  }

  return { todayPnl, dailyLossPct, consecutiveLosses, tradesToday: todayClosed.length };
}
