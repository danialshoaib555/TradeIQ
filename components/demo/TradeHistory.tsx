'use client';
import { useDemoStore } from '@/store/useDemoStore';

const STATUS_COLORS: Record<string, string> = {
  CLOSED: 'text-slate-400 bg-slate-800',
  TP_HIT: 'text-emerald-400 bg-emerald-500/10',
  SL_HIT: 'text-red-400 bg-red-500/10',
};

export default function TradeHistory() {
  const { trades, removeClosedTrade } = useDemoStore();
  const closed = trades.filter(t => t.status !== 'OPEN').slice(0, 50);

  if (closed.length === 0) {
    return <div className="text-center py-12 text-slate-500 text-sm">No closed trades yet</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-slate-500 border-b border-white/5">
            <th className="text-left pb-2 pr-4">Pair</th>
            <th className="text-left pb-2 pr-4">Dir</th>
            <th className="text-right pb-2 pr-4">Entry</th>
            <th className="text-right pb-2 pr-4">Exit</th>
            <th className="text-right pb-2 pr-4">R:R</th>
            <th className="text-left pb-2 pr-4">Status</th>
            <th className="text-left pb-2 pr-4">Emotion</th>
            <th className="text-right pb-2 pr-4">P&L</th>
            <th className="text-right pb-2">Time</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/3">
          {closed.map(trade => {
            const pnlColor = trade.pnl >= 0 ? 'text-emerald-400' : 'text-red-400';
            const holdMin = trade.closeTime ? Math.round((trade.closeTime - trade.openTime) / 60000) : 0;
            return (
              <tr key={trade.id} className="hover:bg-white/2 transition-colors group">
                <td className="py-2.5 pr-4">
                  <div className="font-mono font-semibold text-white text-xs">{trade.pairName}</div>
                  {trade.strategy && <div className="text-xs text-slate-500">{trade.strategy}</div>}
                </td>
                <td className="py-2.5 pr-4">
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${trade.direction === 'LONG' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                    {trade.direction}
                  </span>
                </td>
                <td className="py-2.5 pr-4 text-right font-mono text-xs text-white">{trade.entryPrice.toFixed(5)}</td>
                <td className="py-2.5 pr-4 text-right font-mono text-xs text-slate-300">{trade.exitPrice?.toFixed(5) ?? '—'}</td>
                <td className="py-2.5 pr-4 text-right font-mono text-xs text-slate-300">1:{trade.riskReward.toFixed(1)}</td>
                <td className="py-2.5 pr-4">
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${STATUS_COLORS[trade.status] ?? 'text-slate-400'}`}>
                    {trade.status.replace('_', ' ')}
                  </span>
                </td>
                <td className="py-2.5 pr-4 text-xs text-slate-400 capitalize">{trade.emotion ?? '—'}</td>
                <td className={`py-2.5 pr-4 text-right font-mono text-xs font-bold ${pnlColor}`}>
                  {trade.pnl >= 0 ? '+' : ''}${trade.pnl.toFixed(2)}
                  <div className="text-slate-500 font-normal">{trade.pnlPct >= 0 ? '+' : ''}{trade.pnlPct.toFixed(2)}%</div>
                </td>
                <td className="py-2.5 text-right text-xs text-slate-500">
                  {holdMin < 60 ? `${holdMin}m` : `${Math.round(holdMin / 60)}h`}
                  <button onClick={() => removeClosedTrade(trade.id)}
                    className="ml-2 opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-400 transition-all">✕</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
