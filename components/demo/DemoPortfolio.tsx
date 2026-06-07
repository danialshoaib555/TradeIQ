'use client';
import { useDemoStore } from '@/store/useDemoStore';
import { calcStats } from '@/lib/demo/performanceStats';

export default function DemoPortfolio() {
  const { balance, equity, trades, equityCurve, resetAccount } = useDemoStore();
  const stats = calcStats(trades);
  const openTrades = trades.filter(t => t.status === 'OPEN');
  const openPnl = openTrades.reduce((s, t) => s + t.pnl, 0);
  const totalReturn = ((equity - 10000) / 10000) * 100;
  const isProfit = equity >= 10000;

  return (
    <div className="space-y-4">
      {/* Account summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="Account Balance" value={`$${balance.toFixed(2)}`} sub="Available cash" color="blue" />
        <MetricCard label="Equity" value={`$${equity.toFixed(2)}`}
          sub={`${isProfit ? '+' : ''}${totalReturn.toFixed(2)}% all-time`}
          color={isProfit ? 'green' : 'red'} />
        <MetricCard label="Open P&L" value={`${openPnl >= 0 ? '+' : ''}$${openPnl.toFixed(2)}`}
          sub={`${openTrades.length} open position${openTrades.length !== 1 ? 's' : ''}`}
          color={openPnl >= 0 ? 'green' : 'red'} />
        <MetricCard label="Total P&L" value={`${stats.totalPnl >= 0 ? '+' : ''}$${stats.totalPnl.toFixed(2)}`}
          sub={`${stats.totalTrades} closed trades`}
          color={stats.totalPnl >= 0 ? 'green' : 'red'} />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        <StatBox label="Win Rate" value={`${stats.winRate.toFixed(1)}%`} />
        <StatBox label="Profit Factor" value={stats.profitFactor === 999 ? '∞' : stats.profitFactor.toFixed(2)} />
        <StatBox label="Expectancy" value={`$${stats.expectancy.toFixed(2)}`} />
        <StatBox label="Max Drawdown" value={`${stats.maxDrawdownPct.toFixed(1)}%`} highlight={stats.maxDrawdownPct > 15 ? 'warn' : undefined} />
        <StatBox label="Avg R:R" value={`1:${stats.avgRiskReward.toFixed(1)}`} />
        <StatBox label="Sharpe" value={stats.sharpeRatio.toFixed(2)} />
      </div>

      {/* Equity mini-curve */}
      {equityCurve.length > 1 && (
        <div className="bg-slate-800/40 rounded-xl p-4 border border-white/5">
          <p className="text-xs text-slate-400 mb-3 font-medium">Equity Curve</p>
          <MiniChart data={equityCurve} />
        </div>
      )}

      {/* Reset */}
      <div className="flex justify-end">
        <button onClick={() => { if (confirm('Reset demo account to $10,000? All trades will be cleared.')) resetAccount(); }}
          className="text-xs text-slate-500 hover:text-red-400 transition-colors px-3 py-1.5 border border-white/5 rounded-lg hover:border-red-500/20">
          Reset Account
        </button>
      </div>
    </div>
  );
}

function MetricCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: 'green' | 'red' | 'blue' }) {
  const colors = { green: 'text-emerald-400', red: 'text-red-400', blue: 'text-sky-400' };
  return (
    <div className="bg-slate-800/50 rounded-xl p-4 border border-white/5">
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className={`text-xl font-bold font-mono ${colors[color]}`}>{value}</p>
      <p className="text-xs text-slate-600 mt-0.5">{sub}</p>
    </div>
  );
}

function StatBox({ label, value, highlight }: { label: string; value: string; highlight?: 'warn' }) {
  return (
    <div className="bg-slate-800/30 rounded-lg p-2.5 border border-white/5 text-center">
      <p className="text-xs text-slate-500 mb-0.5">{label}</p>
      <p className={`text-sm font-bold font-mono ${highlight === 'warn' ? 'text-amber-400' : 'text-white'}`}>{value}</p>
    </div>
  );
}

function MiniChart({ data }: { data: { time: number; equity: number }[] }) {
  const min = Math.min(...data.map(d => d.equity));
  const max = Math.max(...data.map(d => d.equity));
  const range = max - min || 1;
  const w = 600, h = 80;
  const pts = data.map((d, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((d.equity - min) / range) * h;
    return `${x},${y}`;
  }).join(' ');
  const isUp = data[data.length - 1].equity >= data[0].equity;
  const color = isUp ? '#10b981' : '#f87171';

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-16" preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" />
      <line x1="0" y1={h - ((10000 - min) / range) * h} x2={w} y2={h - ((10000 - min) / range) * h}
        stroke="#475569" strokeWidth="1" strokeDasharray="4,4" />
    </svg>
  );
}
