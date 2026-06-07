import type { DemoTrade } from '@/store/useDemoStore';

export interface PerformanceStats {
  totalTrades: number;
  winRate: number;
  totalPnl: number;
  totalPnlPct: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  expectancy: number;
  maxDrawdown: number;
  maxDrawdownPct: number;
  sharpeRatio: number;
  bestTrade: number;
  worstTrade: number;
  avgHoldTime: number;
  consecutiveWins: number;
  consecutiveLosses: number;
  longWinRate: number;
  shortWinRate: number;
  avgRiskReward: number;
  recoveryFactor: number;
}

export function calcStats(trades: DemoTrade[]): PerformanceStats {
  const closed = trades.filter(t => t.status !== 'OPEN');
  if (closed.length === 0) {
    return {
      totalTrades: 0, winRate: 0, totalPnl: 0, totalPnlPct: 0,
      avgWin: 0, avgLoss: 0, profitFactor: 0, expectancy: 0,
      maxDrawdown: 0, maxDrawdownPct: 0, sharpeRatio: 0,
      bestTrade: 0, worstTrade: 0, avgHoldTime: 0,
      consecutiveWins: 0, consecutiveLosses: 0,
      longWinRate: 0, shortWinRate: 0, avgRiskReward: 0, recoveryFactor: 0,
    };
  }

  const wins = closed.filter(t => t.pnl > 0);
  const losses = closed.filter(t => t.pnl <= 0);
  const winRate = (wins.length / closed.length) * 100;
  const totalPnl = closed.reduce((s, t) => s + t.pnl, 0);
  const totalPnlPct = closed.reduce((s, t) => s + t.pnlPct, 0);
  const avgWin = wins.length ? wins.reduce((s, t) => s + t.pnl, 0) / wins.length : 0;
  const avgLoss = losses.length ? Math.abs(losses.reduce((s, t) => s + t.pnl, 0) / losses.length) : 0;
  const grossWin = wins.reduce((s, t) => s + t.pnl, 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
  const profitFactor = grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? 999 : 0;
  const expectancy = (winRate / 100) * avgWin - ((100 - winRate) / 100) * avgLoss;

  // Max drawdown from equity curve
  let peak = 10000;
  let maxDD = 0;
  let runningEq = 10000;
  for (const t of [...closed].sort((a, b) => a.openTime - b.openTime)) {
    runningEq += t.pnl;
    if (runningEq > peak) peak = runningEq;
    const dd = peak - runningEq;
    if (dd > maxDD) maxDD = dd;
  }
  const maxDrawdownPct = peak > 0 ? (maxDD / peak) * 100 : 0;

  // Sharpe (simplified daily returns)
  const pnls = closed.map(t => t.pnlPct);
  const mean = pnls.reduce((s, v) => s + v, 0) / pnls.length;
  const variance = pnls.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / pnls.length;
  const stddev = Math.sqrt(variance);
  const sharpeRatio = stddev > 0 ? mean / stddev : 0;

  const bestTrade = Math.max(...closed.map(t => t.pnl));
  const worstTrade = Math.min(...closed.map(t => t.pnl));

  const withHoldTime = closed.filter(t => t.closeTime);
  const avgHoldTime = withHoldTime.length
    ? withHoldTime.reduce((s, t) => s + (t.closeTime! - t.openTime), 0) / withHoldTime.length / 60000
    : 0;

  // Consecutive wins/losses
  let maxConsecWins = 0, maxConsecLosses = 0, cw = 0, cl = 0;
  for (const t of [...closed].sort((a, b) => a.openTime - b.openTime)) {
    if (t.pnl > 0) { cw++; cl = 0; maxConsecWins = Math.max(maxConsecWins, cw); }
    else { cl++; cw = 0; maxConsecLosses = Math.max(maxConsecLosses, cl); }
  }

  const longs = closed.filter(t => t.direction === 'LONG');
  const shorts = closed.filter(t => t.direction === 'SHORT');
  const longWinRate = longs.length ? (longs.filter(t => t.pnl > 0).length / longs.length) * 100 : 0;
  const shortWinRate = shorts.length ? (shorts.filter(t => t.pnl > 0).length / shorts.length) * 100 : 0;

  const avgRiskReward = closed.reduce((s, t) => s + t.riskReward, 0) / closed.length;
  const recoveryFactor = maxDD > 0 ? totalPnl / maxDD : 0;

  return {
    totalTrades: closed.length, winRate, totalPnl, totalPnlPct,
    avgWin, avgLoss, profitFactor, expectancy,
    maxDrawdown: maxDD, maxDrawdownPct, sharpeRatio,
    bestTrade, worstTrade, avgHoldTime,
    consecutiveWins: maxConsecWins, consecutiveLosses: maxConsecLosses,
    longWinRate, shortWinRate, avgRiskReward, recoveryFactor,
  };
}

export function getCoachingInsight(stats: PerformanceStats): string {
  if (stats.totalTrades === 0) return 'Place your first demo trade to get coaching insights.';
  if (stats.winRate < 40) return 'Win rate below 40% — focus on trade selection quality. Only take A+ setups.';
  if (stats.profitFactor < 1) return 'Profit factor below 1.0 — your losses outweigh wins. Tighten stop losses or improve R:R.';
  if (stats.avgRiskReward < 1.5) return 'Average R:R below 1.5 — aim for at least 1:2 to be profitable even at 40% win rate.';
  if (stats.maxDrawdownPct > 20) return 'Max drawdown exceeds 20% — reduce position size. Protect your capital first.';
  if (stats.consecutiveLosses >= 3) return 'You had 3+ consecutive losses. Consider taking a break after 2 losing trades.';
  if (stats.winRate > 60 && stats.profitFactor > 1.5) return 'Strong performance! Win rate and profit factor are both healthy. Stay disciplined.';
  if (stats.longWinRate > stats.shortWinRate + 20) return 'You perform significantly better on LONG trades. Consider filtering out shorts.';
  if (stats.shortWinRate > stats.longWinRate + 20) return 'You perform significantly better on SHORT trades. Consider filtering out longs.';
  return 'Solid foundation. Keep tracking your trades and look for patterns in your winners.';
}
