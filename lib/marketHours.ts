// Market hours in UTC

export type MarketStatus = {
  isOpen: boolean;
  label: string;       // 'OPEN' | 'CLOSED' | '24/7'
  color: string;       // tailwind color classes
  detail: string;      // e.g. 'Closes in 3h 20m'
};

function pad(n: number) { return String(n).padStart(2, '0'); }

function minsUntil(targetH: number, targetM: number, nowH: number, nowM: number): number {
  const totalTarget = targetH * 60 + targetM;
  const totalNow = nowH * 60 + nowM;
  let diff = totalTarget - totalNow;
  if (diff < 0) diff += 24 * 60;
  return diff;
}

function fmtMins(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function getMarketStatus(market: string): MarketStatus {
  const now = new Date();
  const utcDay  = now.getUTCDay();   // 0=Sun, 1=Mon...6=Sat
  const utcH    = now.getUTCHours();
  const utcM    = now.getUTCMinutes();
  const utcMins = utcH * 60 + utcM;

  const isWeekday = utcDay >= 1 && utcDay <= 5;

  // ── Crypto: always open ──────────────────────────────────────────────────
  if (market === 'crypto') {
    return { isOpen: true, label: '24/7', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25', detail: 'Always open' };
  }

  // ── Forex: Mon 00:00 – Fri 22:00 UTC ─────────────────────────────────────
  if (market === 'forex') {
    const open = isWeekday || (utcDay === 0 && utcH >= 22);
    const closingSoon = utcDay === 5 && utcH >= 20; // Friday after 20:00 UTC
    const closed = utcDay === 6 || (utcDay === 5 && utcH >= 22) || (utcDay === 0 && utcH < 22);
    if (closed) {
      const minsTo = utcDay === 6
        ? minsUntil(22, 0, utcH, utcM) + 24 * 60  // Sunday 22:00
        : minsUntil(22, 0, utcH, utcM);
      return { isOpen: false, label: 'CLOSED', color: 'text-red-400 bg-red-500/10 border-red-500/25', detail: `Opens in ${fmtMins(minsTo)}` };
    }
    if (closingSoon) {
      const mins = minsUntil(22, 0, utcH, utcM);
      return { isOpen: true, label: 'OPEN', color: 'text-amber-400 bg-amber-500/10 border-amber-500/25', detail: `Closes in ${fmtMins(mins)}` };
    }
    return { isOpen: true, label: 'OPEN', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25', detail: '24/5 · Mon–Fri' };
  }

  // ── US Stocks & US Indices: Mon–Fri 13:30–20:00 UTC ─────────────────────
  if (market === 'stocks' || market === 'indices') {
    const openMins  = 13 * 60 + 30;  // 13:30 UTC
    const closeMins = 20 * 60;        // 20:00 UTC
    const isOpenNow = isWeekday && utcMins >= openMins && utcMins < closeMins;
    if (isOpenNow) {
      const mins = closeMins - utcMins;
      return { isOpen: true, label: 'OPEN', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25', detail: `Closes in ${fmtMins(mins)}` };
    }
    // Pre-market / after-hours
    const preMarket = isWeekday && utcMins >= 9 * 60 && utcMins < openMins;
    if (preMarket) {
      const mins = openMins - utcMins;
      return { isOpen: false, label: 'PRE', color: 'text-amber-400 bg-amber-500/10 border-amber-500/25', detail: `Opens in ${fmtMins(mins)}` };
    }
    const afterHours = isWeekday && utcMins >= closeMins && utcMins < 22 * 60;
    if (afterHours) {
      return { isOpen: false, label: 'AH', color: 'text-amber-400 bg-amber-500/10 border-amber-500/25', detail: 'After-hours' };
    }
    return { isOpen: false, label: 'CLOSED', color: 'text-red-400 bg-red-500/10 border-red-500/25', detail: 'NYSE/NASDAQ 13:30–20:00 UTC' };
  }

  // ── Commodities: Mon 23:00 Sun – Fri 22:00 UTC (nearly 24/5) ────────────
  if (market === 'commodities') {
    const closed = utcDay === 6 || (utcDay === 0 && utcH < 23) || (utcDay === 5 && utcH >= 22);
    if (closed) {
      return { isOpen: false, label: 'CLOSED', color: 'text-red-400 bg-red-500/10 border-red-500/25', detail: 'Opens Sun 23:00 UTC' };
    }
    if (utcDay === 5 && utcH >= 20) {
      const mins = minsUntil(22, 0, utcH, utcM);
      return { isOpen: true, label: 'OPEN', color: 'text-amber-400 bg-amber-500/10 border-amber-500/25', detail: `Closes in ${fmtMins(mins)}` };
    }
    return { isOpen: true, label: 'OPEN', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25', detail: 'Sun 23:00 – Fri 22:00 UTC' };
  }

  return { isOpen: true, label: 'OPEN', color: 'text-slate-400 bg-slate-500/10 border-slate-500/25', detail: '' };
}

export function getAllMarketStatuses() {
  const markets = ['crypto', 'forex', 'stocks', 'indices', 'commodities'] as const;
  return markets.map(m => ({ market: m, ...getMarketStatus(m) }));
}

// For session clock / top bar display
export function getLiveMarkets(): string[] {
  return ['crypto', 'forex', 'stocks', 'indices', 'commodities'].filter(m => getMarketStatus(m).isOpen);
}
