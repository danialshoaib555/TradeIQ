'use client';
import { useState, useEffect, useRef } from 'react';
import type { Pair } from '@/lib/pairConfig';

interface PriceAlert {
  id: string;
  pairId: string;
  pairName: string;
  price: number;
  direction: 'above' | 'below';
  createdAt: number;
  triggered: boolean;
  triggeredAt?: number;
}

const STORAGE_KEY = 'tradeiq-price-alerts';

function loadAlerts(): PriceAlert[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveAlerts(alerts: PriceAlert[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(alerts)); } catch {}
}

export default function PriceAlerts({ pair, livePrice }: { pair: Pair; livePrice: number | null }) {
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [priceInput, setPriceInput] = useState('');
  const [justTriggered, setJustTriggered] = useState<string | null>(null);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const alertsRef = useRef<PriceAlert[]>([]);

  const dp = pair.market === 'crypto' ? 2 : 5;

  useEffect(() => {
    setAlerts(loadAlerts());
    if (typeof Notification === 'undefined') setNotifPermission('unsupported');
    else setNotifPermission(Notification.permission);
  }, []);

  useEffect(() => { alertsRef.current = alerts; }, [alerts]);

  // Check alerts against live price
  useEffect(() => {
    if (!livePrice) return;
    const active = alertsRef.current.filter(a => !a.triggered && a.pairId === pair.id);
    if (active.length === 0) return;

    let changed = false;
    const next = alertsRef.current.map(a => {
      if (a.triggered || a.pairId !== pair.id) return a;
      const hit = a.direction === 'above' ? livePrice >= a.price : livePrice <= a.price;
      if (!hit) return a;
      changed = true;
      // Fire browser notification
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        try {
          new Notification(`${a.pairName} alert`, {
            body: `Price crossed ${a.direction} ${a.price.toFixed(dp)} — now ${livePrice.toFixed(dp)}`,
          });
        } catch {}
      }
      setJustTriggered(a.id);
      setTimeout(() => setJustTriggered(null), 5000);
      return { ...a, triggered: true, triggeredAt: Date.now() };
    });

    if (changed) {
      setAlerts(next);
      saveAlerts(next);
    }
  }, [livePrice, pair.id, dp]);

  const addAlert = (direction: 'above' | 'below') => {
    const price = parseFloat(priceInput);
    if (!price || price <= 0) return;
    const alert: PriceAlert = {
      id: `alert_${Date.now()}`,
      pairId: pair.id,
      pairName: pair.name,
      price,
      direction,
      createdAt: Date.now(),
      triggered: false,
    };
    const next = [alert, ...alerts];
    setAlerts(next);
    saveAlerts(next);
    setPriceInput('');
    // Request notification permission on first alert
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().then(p => setNotifPermission(p));
    }
  };

  const removeAlert = (id: string) => {
    const next = alerts.filter(a => a.id !== id);
    setAlerts(next);
    saveAlerts(next);
  };

  const pairAlerts = alerts.filter(a => a.pairId === pair.id);
  const otherActive = alerts.filter(a => a.pairId !== pair.id && !a.triggered).length;

  return (
    <div className="space-y-3 text-sm">
      {/* Current price */}
      <div className="bg-slate-800/60 rounded-lg px-3 py-2.5 border border-white/5 flex items-center justify-between">
        <span className="text-xs text-slate-500">Current price</span>
        <span className="font-mono text-sm text-white font-bold">
          {livePrice ? livePrice.toFixed(dp) : '—'}
        </span>
      </div>

      {/* Add alert */}
      <div className="bg-slate-900/50 rounded-xl border border-white/8 p-3 space-y-2">
        <p className="text-xs font-semibold text-white">New Alert — {pair.name}</p>
        <input
          value={priceInput}
          onChange={e => setPriceInput(e.target.value)}
          type="number" step="any" min="0"
          placeholder={livePrice ? `e.g. ${livePrice.toFixed(dp)}` : 'Target price'}
          className="w-full bg-slate-900/60 border border-white/8 rounded-lg px-3 py-2 text-xs text-white font-mono outline-none focus:border-emerald-500/40"
        />
        <div className="flex gap-1.5">
          <button onClick={() => addAlert('above')}
            disabled={!priceInput}
            className="flex-1 py-2 rounded-lg text-xs font-bold transition-all border bg-emerald-500/15 text-emerald-400 border-emerald-500/25 hover:bg-emerald-500/25 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">
            ▲ Crosses above
          </button>
          <button onClick={() => addAlert('below')}
            disabled={!priceInput}
            className="flex-1 py-2 rounded-lg text-xs font-bold transition-all border bg-red-500/15 text-red-400 border-red-500/25 hover:bg-red-500/25 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">
            ▼ Crosses below
          </button>
        </div>
        {notifPermission === 'denied' && (
          <p className="text-xs text-amber-400">Browser notifications blocked — alerts will only show here.</p>
        )}
      </div>

      {/* Alert list for this pair */}
      <div className="space-y-1.5">
        {pairAlerts.length === 0 && (
          <p className="text-xs text-slate-600 text-center py-3">No alerts for {pair.name}</p>
        )}
        {pairAlerts.map(a => (
          <div key={a.id}
            className={`flex items-center gap-2 rounded-lg px-2.5 py-2 border text-xs transition-all ${
              justTriggered === a.id
                ? 'bg-amber-500/15 border-amber-500/40 animate-pulse'
                : a.triggered
                  ? 'bg-slate-800/30 border-white/5 opacity-60'
                  : a.direction === 'above'
                    ? 'bg-emerald-500/5 border-emerald-500/15'
                    : 'bg-red-500/5 border-red-500/15'
            }`}>
            <span className={a.direction === 'above' ? 'text-emerald-400' : 'text-red-400'}>
              {a.direction === 'above' ? '▲' : '▼'}
            </span>
            <span className="font-mono text-white">{a.price.toFixed(dp)}</span>
            {a.triggered ? (
              <span className="ml-auto text-amber-400 font-medium">TRIGGERED</span>
            ) : (
              <span className="ml-auto text-slate-500">waiting</span>
            )}
            <button onClick={() => removeAlert(a.id)}
              aria-label="Delete alert"
              className="text-slate-600 hover:text-red-400 transition-colors p-1 cursor-pointer">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>

      {otherActive > 0 && (
        <p className="text-xs text-slate-600 text-center">{otherActive} active alert{otherActive > 1 ? 's' : ''} on other pairs</p>
      )}
    </div>
  );
}
