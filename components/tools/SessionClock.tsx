'use client';
import { useEffect, useState } from 'react';
import { getSessionStatus, getBestSession } from '@/lib/sessionUtils';

export default function SessionClock() {
  const [sessions, setSessions]     = useState(getSessionStatus());
  const [best, setBest]             = useState(getBestSession());
  const [utcTime, setUtcTime]       = useState('');

  useEffect(() => {
    const tick = () => {
      setSessions(getSessionStatus());
      setBest(getBestSession());
      const now = new Date();
      setUtcTime(
        `${String(now.getUTCHours()).padStart(2,'0')}:${String(now.getUTCMinutes()).padStart(2,'0')} UTC`
      );
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  const qualityBg: Record<string, string> = {
    best:     'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
    good:     'bg-blue-500/10 border-blue-500/20 text-blue-400',
    moderate: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
    poor:     'bg-red-500/10 border-red-500/20 text-red-400',
  };

  const isWeekend = best.quality === 'poor' && (best.name.includes('Weekend') || best.name.includes('Forex opens'));

  return (
    <div className="bg-white/2 border border-white/8 rounded-2xl p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-white flex items-center gap-2">
          <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Market Sessions
        </h3>
        <span className="font-mono text-xs text-slate-500">{utcTime}</span>
      </div>

      {/* Weekend warning */}
      {isWeekend && (
        <div className="mb-4 px-3 py-2.5 bg-red-500/8 border border-red-500/20 rounded-xl flex items-start gap-2">
          <span className="text-red-400 text-sm mt-px">⚠</span>
          <div>
            <p className="text-xs font-semibold text-red-400">{best.name}</p>
            <p className="text-xs text-red-400/70 mt-0.5">{best.message}</p>
          </div>
        </div>
      )}

      {/* Session list */}
      <div className="space-y-3 mb-4">
        {sessions.map(s => (
          <div key={s.name} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${s.isOpen ? 'animate-pulse' : 'opacity-25'}`}
                style={{ backgroundColor: s.color }}
              />
              <span className={`text-sm font-medium ${s.isOpen ? 'text-white' : 'text-slate-500'}`}>{s.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-slate-600">{s.displayHours}</span>
              <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                s.alwaysOpen ? 'bg-purple-500/15 text-purple-400' :
                s.isOpen     ? 'bg-emerald-500/15 text-emerald-400' : 'bg-white/3 text-slate-600'
              }`}>
                {s.alwaysOpen ? '24/7' : s.isOpen ? 'OPEN' : 'CLOSED'}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Best session / advice */}
      <div className={`p-3 border rounded-xl ${qualityBg[best.quality] ?? qualityBg.poor}`}>
        <div className="flex items-center gap-1.5 mb-1">
          <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${
            best.quality === 'best' ? 'bg-emerald-400' :
            best.quality === 'good' ? 'bg-blue-400' :
            best.quality === 'moderate' ? 'bg-amber-400' : 'bg-red-400'
          }`} />
          <span className="text-xs font-semibold">{best.name}</span>
        </div>
        <p className="text-xs opacity-80">{best.message}</p>
        {best.tradeable && best.tradeable.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {best.tradeable.map(t => (
              <span key={t} className="px-1.5 py-0.5 rounded text-[10px] bg-white/10 text-white/70 border border-white/10">{t}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
