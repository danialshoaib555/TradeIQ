'use client';
import { useEffect, useState } from 'react';

interface Event { title: string; currency: string; date: string; impact: string; forecast: string; previous: string; }

const FALLBACK: Event[] = [
  { title: 'Non-Farm Payrolls', currency: 'USD', date: '', impact: 'High', forecast: '200K', previous: '187K' },
  { title: 'CPI (YoY)', currency: 'USD', date: '', impact: 'High', forecast: '3.2%', previous: '3.4%' },
  { title: 'ECB Rate Decision', currency: 'EUR', date: '', impact: 'High', forecast: '4.5%', previous: '4.5%' },
  { title: 'GDP (QoQ)', currency: 'GBP', date: '', impact: 'Medium', forecast: '0.1%', previous: '-0.1%' },
  { title: 'Trade Balance', currency: 'JPY', date: '', impact: 'Low', forecast: '-¥200B', previous: '-¥180B' },
];

export default function EconomicCalendar() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/calendar')
      .then(r => r.json())
      .then((data: Event[]) => setEvents(data.length ? data.slice(0, 8) : FALLBACK))
      .catch(() => setEvents(FALLBACK))
      .finally(() => setLoading(false));
  }, []);

  const ic: Record<string, string> = {
    High:   'text-red-400 bg-red-500/10 border-red-500/20',
    Medium: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    Low:    'text-slate-400 bg-slate-500/10 border-slate-500/15',
  };

  return (
    <div className="bg-white/2 border border-white/8 rounded-2xl p-5">
      <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
        <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        Economic Calendar
      </h3>
      {loading ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-10 bg-white/5 rounded-lg animate-pulse" />)}</div>
      ) : (
        <div className="space-y-1">
          {events.map((ev, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-white/3 last:border-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs font-mono font-bold text-slate-400 w-8 flex-shrink-0">{ev.currency}</span>
                <span className="text-xs text-slate-300 truncate">{ev.title}</span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                {ev.forecast && <span className="text-xs font-mono text-slate-500">{ev.forecast}</span>}
                <span className={`px-1.5 py-0.5 rounded text-xs border ${ic[ev.impact] ?? ic.Low}`}>{ev.impact}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
