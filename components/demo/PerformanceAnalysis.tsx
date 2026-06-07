'use client';
import { useDemoStore } from '@/store/useDemoStore';
import { calcStats, getCoachingInsight } from '@/lib/demo/performanceStats';

export default function PerformanceAnalysis() {
  const { trades } = useDemoStore();
  const stats = calcStats(trades);
  const insight = getCoachingInsight(stats);

  const closedByStrategy = trades.filter(t => t.status !== 'OPEN' && t.strategy);
  const strategies = Array.from(new Set(closedByStrategy.map(t => t.strategy!)));

  const emotionStats = (['disciplined', 'confident', 'fearful', 'greedy', 'neutral'] as const).map(em => {
    const emTrades = trades.filter(t => t.status !== 'OPEN' && t.emotion === em);
    const wins = emTrades.filter(t => t.pnl > 0).length;
    const totalPnl = emTrades.reduce((s, t) => s + t.pnl, 0);
    return { emotion: em, count: emTrades.length, winRate: emTrades.length ? (wins / emTrades.length) * 100 : 0, totalPnl };
  }).filter(e => e.count > 0);

  return (
    <div className="space-y-4">
      {/* Coaching insight */}
      <div className="bg-amber-500/5 border border-amber-500/15 rounded-xl p-4">
        <div className="flex items-start gap-2">
          <span className="text-amber-400 text-lg mt-0.5">🎯</span>
          <div>
            <p className="text-xs font-semibold text-amber-400 mb-0.5">Coaching Insight</p>
            <p className="text-sm text-slate-300">{insight}</p>
          </div>
        </div>
      </div>

      {/* Core stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Win Rate" value={`${stats.winRate.toFixed(1)}%`}
          bar={stats.winRate} barColor={stats.winRate >= 50 ? 'emerald' : 'red'} />
        <StatCard label="Profit Factor" value={stats.profitFactor === 999 ? '∞' : stats.profitFactor.toFixed(2)}
          bar={Math.min(stats.profitFactor * 33, 100)} barColor={stats.profitFactor >= 1 ? 'emerald' : 'red'} />
        <StatCard label="LONG Win Rate" value={`${stats.longWinRate.toFixed(1)}%`}
          bar={stats.longWinRate} barColor="sky" />
        <StatCard label="SHORT Win Rate" value={`${stats.shortWinRate.toFixed(1)}%`}
          bar={stats.shortWinRate} barColor="purple" />
      </div>

      {/* Detailed metrics */}
      <div className="bg-slate-800/40 rounded-xl border border-white/5 p-4">
        <p className="text-xs font-semibold text-slate-400 mb-3">Detailed Metrics</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
          <Row label="Total Trades" value={String(stats.totalTrades)} />
          <Row label="Avg Win" value={`+$${stats.avgWin.toFixed(2)}`} green />
          <Row label="Avg Loss" value={`-$${stats.avgLoss.toFixed(2)}`} red />
          <Row label="Best Trade" value={`+$${stats.bestTrade.toFixed(2)}`} green />
          <Row label="Worst Trade" value={`$${stats.worstTrade.toFixed(2)}`} red />
          <Row label="Expectancy" value={`$${stats.expectancy.toFixed(2)}`} green={stats.expectancy >= 0} red={stats.expectancy < 0} />
          <Row label="Max Drawdown" value={`${stats.maxDrawdownPct.toFixed(1)}%`} red />
          <Row label="Sharpe Ratio" value={stats.sharpeRatio.toFixed(2)} />
          <Row label="Recovery Factor" value={stats.recoveryFactor.toFixed(2)} />
          <Row label="Avg R:R" value={`1:${stats.avgRiskReward.toFixed(1)}`} />
          <Row label="Max Consec. Wins" value={String(stats.consecutiveWins)} green />
          <Row label="Max Consec. Losses" value={String(stats.consecutiveLosses)} red />
          <Row label="Avg Hold Time" value={stats.avgHoldTime < 60 ? `${stats.avgHoldTime.toFixed(0)}m` : `${(stats.avgHoldTime / 60).toFixed(1)}h`} />
        </div>
      </div>

      {/* Strategy breakdown */}
      {strategies.length > 0 && (
        <div className="bg-slate-800/40 rounded-xl border border-white/5 p-4">
          <p className="text-xs font-semibold text-slate-400 mb-3">Strategy Breakdown</p>
          <div className="space-y-2">
            {strategies.map(strat => {
              const stTrades = closedByStrategy.filter(t => t.strategy === strat);
              const wins = stTrades.filter(t => t.pnl > 0).length;
              const pnl = stTrades.reduce((s, t) => s + t.pnl, 0);
              const wr = (wins / stTrades.length) * 100;
              return (
                <div key={strat} className="flex items-center gap-3 text-xs">
                  <span className="text-white font-medium w-32 truncate">{strat}</span>
                  <span className="text-slate-500">{stTrades.length} trades</span>
                  <span className={wr >= 50 ? 'text-emerald-400' : 'text-red-400'}>{wr.toFixed(0)}% WR</span>
                  <span className={`ml-auto font-mono font-bold ${pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Emotion analysis */}
      {emotionStats.length > 0 && (
        <div className="bg-slate-800/40 rounded-xl border border-white/5 p-4">
          <p className="text-xs font-semibold text-slate-400 mb-3">Emotion vs Performance</p>
          <div className="space-y-2">
            {emotionStats.map(e => (
              <div key={e.emotion} className="flex items-center gap-3 text-xs">
                <span className="text-white capitalize w-24">{e.emotion}</span>
                <span className="text-slate-500">{e.count} trades</span>
                <span className={e.winRate >= 50 ? 'text-emerald-400' : 'text-red-400'}>{e.winRate.toFixed(0)}% WR</span>
                <span className={`ml-auto font-mono font-bold ${e.totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {e.totalPnl >= 0 ? '+' : ''}${e.totalPnl.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, bar, barColor }: { label: string; value: string; bar: number; barColor: string }) {
  const colors: Record<string, string> = {
    emerald: 'bg-emerald-500', red: 'bg-red-500', sky: 'bg-sky-500', purple: 'bg-purple-500',
  };
  return (
    <div className="bg-slate-800/50 rounded-xl p-3 border border-white/5">
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className="text-lg font-bold font-mono text-white mb-2">{value}</p>
      <div className="h-1 bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${colors[barColor]}`} style={{ width: `${Math.min(bar, 100)}%` }} />
      </div>
    </div>
  );
}

function Row({ label, value, green, red }: { label: string; value: string; green?: boolean; red?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1 border-b border-white/3 last:border-0">
      <span className="text-slate-500 text-xs">{label}</span>
      <span className={`font-mono text-xs font-medium ${green ? 'text-emerald-400' : red ? 'text-red-400' : 'text-white'}`}>{value}</span>
    </div>
  );
}
