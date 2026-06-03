'use client';
import { useEffect, useState } from 'react';
import { getSessionStatus } from '@/lib/sessionUtils';

export default function SessionClock() {
  const [sessions, setSessions] = useState(getSessionStatus());

  useEffect(() => {
    const tick = () => setSessions(getSessionStatus());
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="bg-white/2 border border-white/8 rounded-2xl p-5">
      <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
        <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Market Sessions
      </h3>
      <div className="space-y-3">
        {sessions.map(s => (
          <div key={s.name} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-2.5 h-2.5 rounded-full ${s.isOpen ? 'animate-pulse' : 'opacity-25'}`} style={{ backgroundColor: s.color }} />
              <span className={`text-sm font-medium ${s.isOpen ? 'text-white' : 'text-slate-500'}`}>{s.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-slate-500">
                {String(s.open).padStart(2,'0')}:00–{String(s.close).padStart(2,'0')}:00 UTC
              </span>
              <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${s.isOpen ? 'bg-emerald-500/15 text-emerald-400' : 'bg-white/3 text-slate-600'}`}>
                {s.isOpen ? 'OPEN' : 'CLOSED'}
              </span>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 p-3 bg-amber-500/5 border border-amber-500/15 rounded-xl">
        <p className="text-xs text-amber-400/80">Best time: <span className="font-semibold">13:00–17:00 UTC</span> (London + NY overlap)</p>
      </div>
    </div>
  );
}
