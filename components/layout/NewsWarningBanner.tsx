'use client';
import { useEffect, useState } from 'react';

interface CalendarEvent { title: string; currency: string; date: string; impact: string; }

export default function NewsWarningBanner() {
  const [event, setEvent] = useState<CalendarEvent | null>(null);

  useEffect(() => {
    fetch('/api/calendar')
      .then(r => r.json())
      .then((events: CalendarEvent[]) => {
        const now = Date.now();
        const window = 30 * 60 * 1000;
        const high = events.find(e => {
          const t = new Date(e.date).getTime();
          return e.impact === 'High' && t > now && t - now < window;
        });
        setEvent(high ?? null);
      })
      .catch(() => {});
  }, []);

  if (!event) return null;

  return (
    <div className="bg-red-500/10 border-b border-red-500/20 px-6 py-2 flex items-center gap-3">
      <svg className="w-4 h-4 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
      <span className="text-sm text-red-300">
        <span className="font-semibold">High-impact event in &lt;30 min:</span>{' '}
        {event.title} ({event.currency}) — consider waiting
      </span>
    </div>
  );
}
