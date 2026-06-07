'use client';
import { useEffect, useState } from 'react';
import { getSessionStatus, getBestSession } from '@/lib/sessionUtils';

export default function TopBar() {
  const [time, setTime]           = useState('');
  const [sessions, setSessions]   = useState(getSessionStatus());
  const [bestSession, setBestSession] = useState(getBestSession());

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const h = String(now.getUTCHours()).padStart(2, '0');
      const m = String(now.getUTCMinutes()).padStart(2, '0');
      const s = String(now.getUTCSeconds()).padStart(2, '0');
      setTime(`${h}:${m}:${s} UTC`);
      setSessions(getSessionStatus());
      setBestSession(getBestSession());
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const qualityColors: Record<string, string> = {
    best:     'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    good:     'text-blue-400 bg-blue-500/10 border-blue-500/20',
    moderate: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    poor:     'text-red-400 bg-red-500/10 border-red-500/20',
  };

  const isWeekend = bestSession.quality === 'poor' &&
    (bestSession.name.includes('Weekend') || bestSession.name.includes('Forex opens'));

  return (
    <>
      {/* Weekend warning banner */}
      {isWeekend && (
        <div className="bg-red-500/10 border-b border-red-500/20 px-6 py-1.5 flex items-center gap-3">
          <span className="text-red-400 text-xs">⚠</span>
          <p className="text-xs text-red-400 font-medium">{bestSession.name} — {bestSession.message}</p>
          <div className="flex items-center gap-1.5 ml-auto">
            <span className="text-xs text-red-400/60">Tradeable now:</span>
            {(bestSession.tradeable ?? []).map(t => (
              <span key={t} className="px-1.5 py-0.5 rounded text-[10px] bg-red-500/10 text-red-400 border border-red-500/20">{t}</span>
            ))}
          </div>
        </div>
      )}

      <header className="bg-slate-900/60 backdrop-blur-xl border-b border-white/5 px-6 py-3 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-4">
          <span className="font-mono text-sm text-slate-300">{time}</span>
          <div className="flex items-center gap-2">
            {sessions.map(s => (
              <span key={s.name} className={`px-2 py-0.5 rounded text-xs font-medium border transition-all ${
                s.isOpen
                  ? 'text-white bg-white/8 border-white/12'
                  : 'text-slate-600 bg-transparent border-transparent'
              }`}>
                {s.name.split(' ')[0]} {s.isOpen ? '●' : '○'}
              </span>
            ))}
          </div>
        </div>
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium ${qualityColors[bestSession.quality] ?? qualityColors.poor}`}>
          <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${
            bestSession.quality === 'best'     ? 'bg-emerald-400' :
            bestSession.quality === 'good'     ? 'bg-blue-400'    :
            bestSession.quality === 'moderate' ? 'bg-amber-400'   : 'bg-red-400'
          }`} />
          {bestSession.name}
        </div>
      </header>
    </>
  );
}
