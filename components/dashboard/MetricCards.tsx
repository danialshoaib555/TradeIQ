'use client';
import { useSignalStore } from '@/store/useSignalStore';
import { getBestSession } from '@/lib/sessionUtils';

export default function MetricCards() {
  const { signals, lastRefresh } = useSignalStore();
  const list = Object.values(signals).filter(Boolean);
  const buys  = list.filter(s => s?.signal.signal === 'BUY').length;
  const sells = list.filter(s => s?.signal.signal === 'SELL').length;

  const best = list
    .filter(s => s?.signal.signal !== 'WAIT')
    .sort((a, b) => b.signal.confidence - a.signal.confidence)[0];

  const session = getBestSession();
  const qColor: Record<string, string> = {
    best: 'text-emerald-400', good: 'text-blue-400', poor: 'text-amber-400',
  };

  const refreshText = lastRefresh
    ? `${Math.round((Date.now() - lastRefresh) / 60000)}m ago`
    : 'Loading...';

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {[
        {
          label: 'Best Opportunity',
          value: best?.pairName ?? '—',
          sub: best ? `${best.signal.signal} · ${best.signal.confidence}%` : 'No signal yet',
          icon: <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>,
          border: 'border-emerald-500/15',
        },
        {
          label: 'Active Signals',
          value: `${buys + sells}`,
          sub: `${buys} BUY · ${sells} SELL · ${list.length} total`,
          icon: <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" /></svg>,
          border: 'border-blue-500/15',
        },
        {
          label: 'Best Session',
          value: session.name,
          sub: session.message,
          icon: <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
          border: 'border-slate-500/15',
          valueClass: qColor[session.quality],
        },
        {
          label: 'Last Updated',
          value: refreshText,
          sub: 'Auto-refresh every 5 min',
          icon: <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>,
          border: 'border-amber-500/15',
        },
      ].map(card => (
        <div key={card.label} className={`bg-white/2 border ${card.border} rounded-2xl p-4`}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-slate-500">{card.label}</span>
            <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">{card.icon}</div>
          </div>
          <div className={`font-bold text-lg font-mono leading-tight mb-1 ${card.valueClass ?? 'text-white'}`}>{card.value}</div>
          <div className="text-xs text-slate-500">{card.sub}</div>
        </div>
      ))}
    </div>
  );
}
