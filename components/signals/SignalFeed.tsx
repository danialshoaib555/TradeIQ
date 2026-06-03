'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PAIRS } from '@/lib/pairConfig';
import { useSignalStore, type PairSignal } from '@/store/useSignalStore';
import { calculateSignal } from '@/lib/signalEngine';
import { calculateLevels } from '@/lib/levelCalculator';
import { getBestStrategy } from '@/lib/strategyMatcher';

const WAIT_SIGNAL = { signal: 'WAIT' as const, confidence: 0, reasons: ['Data unavailable'], indicators: { rsi: 50, ema9: 0, ema21: 0, macd: undefined, macdSignal: undefined, bb: undefined, adx: undefined, atr: undefined, trending: false }, conditions: { rsi: false, ema: false, macd: false, vol: false, bb: false } };

export default function SignalFeed() {
  const { signals, setSignal, setLastRefresh } = useSignalStore();
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'confidence' | 'signal'>('confidence');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.allSettled(
        PAIRS.map(async (pair) => {
          try {
            const res = await fetch(`/api/ohlcv/${pair.id}?tf=1h`);
            if (!res.ok) throw new Error('fetch failed');
            const ohlcv = await res.json();
            if (!Array.isArray(ohlcv) || ohlcv.length < 30) throw new Error('no data');
            const signal = calculateSignal(ohlcv);
            const levels = calculateLevels(ohlcv, signal.signal, pair);
            const { best } = getBestStrategy(signal);
            setSignal(pair.id, { pairId: pair.id, pairName: pair.name, market: pair.market, signal, levels, strategy: best, price: ohlcv.at(-1)?.close ?? 0, updatedAt: Date.now(), loading: false, error: null });
          } catch {
            setSignal(pair.id, { pairId: pair.id, pairName: pair.name, market: pair.market, signal: WAIT_SIGNAL, levels: null, strategy: null, price: 0, updatedAt: Date.now(), loading: false, error: 'Data unavailable' });
          }
        })
      );
      setLastRefresh(Date.now());
      setLoading(false);
    };
    load();
    const id = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [setSignal, setLastRefresh]);

  const list = Object.values(signals).filter(Boolean) as PairSignal[];
  const sorted = [...list].sort((a, b) =>
    sortBy === 'confidence'
      ? b.signal.confidence - a.signal.confidence
      : ({'BUY':0,'SELL':1,'WAIT':2}[a.signal.signal] ?? 2) - ({'BUY':0,'SELL':1,'WAIT':2}[b.signal.signal] ?? 2)
  );
  const buys  = sorted.filter(s => s.signal.signal === 'BUY').length;
  const sells = sorted.filter(s => s.signal.signal === 'SELL').length;

  const sColor: Record<string, string> = {
    BUY:  'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    SELL: 'text-red-400 bg-red-500/10 border-red-500/20',
    WAIT: 'text-slate-600 bg-transparent border-transparent',
  };

  return (
    <div className="bg-white/2 border border-white/8 rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="font-semibold text-white">Signal Feed</h2>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-emerald-400">{buys} BUY</span>
            <span className="text-slate-600">·</span>
            <span className="text-red-400">{sells} SELL</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {loading && (
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <div className="w-3 h-3 border border-slate-500 border-t-transparent rounded-full animate-spin" />
              Loading...
            </div>
          )}
          <select value={sortBy} onChange={e => setSortBy(e.target.value as 'confidence' | 'signal')}
            className="text-xs bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-slate-400 cursor-pointer"
          >
            <option value="confidence">Sort: Confidence</option>
            <option value="signal">Sort: Signal</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/5">
              {['Pair', 'Market', 'Strategy', 'Signal', 'Confidence', 'Entry', 'TP1', 'SL', 'R:R', 'Action'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map(row => (
              <tr key={row.pairId} className="border-b border-white/3 hover:bg-white/3 transition-colors duration-150">
                <td className="px-4 py-3 font-mono font-medium text-white">{row.pairName}</td>
                <td className="px-4 py-3 text-slate-400 capitalize text-xs">{row.market}</td>
                <td className="px-4 py-3">
                  {row.strategy && <span className="px-1.5 py-0.5 rounded text-xs bg-blue-500/10 text-blue-400 border border-blue-500/15 whitespace-nowrap">{row.strategy.chipLabel}</span>}
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-bold border ${sColor[row.signal.signal]}`}>{row.signal.signal}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${row.signal.confidence >= 70 ? 'bg-emerald-500' : row.signal.confidence >= 50 ? 'bg-amber-500' : 'bg-slate-600'}`}
                        style={{ width: `${row.signal.confidence}%` }} />
                    </div>
                    <span className="text-xs font-mono text-slate-400">{row.signal.confidence}%</span>
                  </div>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-blue-300">{row.levels?.entry ?? '—'}</td>
                <td className="px-4 py-3 font-mono text-xs text-emerald-400">{row.levels?.tp1 ?? '—'}</td>
                <td className="px-4 py-3 font-mono text-xs text-red-400">{row.levels?.sl ?? '—'}</td>
                <td className="px-4 py-3 font-mono text-xs text-slate-400">{row.levels ? `1:${row.levels.rr}` : '—'}</td>
                <td className="px-4 py-3">
                  <Link href={`/chart/${row.pairId}`} className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/8 text-xs text-slate-400 hover:text-white transition-all duration-150 cursor-pointer whitespace-nowrap">
                    View Chart
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {sorted.length === 0 && !loading && (
          <div className="py-16 text-center text-slate-500">No signals loaded yet</div>
        )}
      </div>
    </div>
  );
}
