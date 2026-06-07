'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { PAIRS, MARKET_COLORS } from '@/lib/pairConfig';
import { useSignalStore, type PairSignal } from '@/store/useSignalStore';
import { calculateSignal } from '@/lib/signalEngine';
import { calculateLevels } from '@/lib/levelCalculator';
import { getBestStrategy } from '@/lib/strategyMatcher';
import { getMarketStatus } from '@/lib/marketHours';

const PAGE = 25;

const WAIT_SIGNAL = {
  signal: 'WAIT' as const, confidence: 0, reasons: ['Data unavailable'],
  indicators: { rsi: 50, ema9: 0, ema21: 0, macd: undefined, macdSignal: undefined, bb: undefined, adx: undefined, atr: undefined, trending: false },
  conditions: { rsi: false, ema: false, macd: false, vol: false, bb: false },
};

export default function SignalFeed() {
  const { signals, setSignal, setLastRefresh } = useSignalStore();
  const [loading, setLoading] = useState(true);
  const [loadedCount, setLoadedCount] = useState(0);
  const [sortBy, setSortBy] = useState<'confidence' | 'signal'>('confidence');
  const [marketFilter, setMarketFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [countdown, setCountdown] = useState(300);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setRefreshing(true);
    setLoadedCount(0);
    let done = 0;

    await Promise.allSettled(
      PAIRS.map(async (pair) => {
        try {
          let ohlcv: { time: number; open: number; high: number; low: number; close: number; volume: number }[] = [];

          if (pair.market === 'crypto' && pair.binanceSymbol) {
            // Fetch directly from Binance browser-side — avoids Vercel server IP blocks
            const res = await fetch(
              `https://api.binance.com/api/v3/klines?symbol=${pair.binanceSymbol.toUpperCase()}&interval=1h&limit=200`
            );
            if (!res.ok) throw new Error(`Binance ${res.status}`);
            const raw: string[][] = await res.json();
            ohlcv = raw
              .map(k => ({
                time:   Math.floor(parseInt(k[0]) / 1000),
                open:   parseFloat(k[1]),
                high:   parseFloat(k[2]),
                low:    parseFloat(k[3]),
                close:  parseFloat(k[4]),
                volume: parseFloat(k[5]),
              }))
              .filter(c => c.close > 0 && c.time > 0);
          } else {
            const res = await fetch(`/api/ohlcv/${pair.id}?tf=1h`);
            if (!res.ok) throw new Error('fetch failed');
            ohlcv = await res.json();
          }

          if (!Array.isArray(ohlcv) || ohlcv.length < 30) throw new Error('no data');
          const signal = calculateSignal(ohlcv);
          const levels = calculateLevels(ohlcv, signal.signal, pair);
          const { best } = getBestStrategy(signal);
          setSignal(pair.id, { pairId: pair.id, pairName: pair.name, market: pair.market, exchange: pair.exchange, signal, levels, strategy: best, price: ohlcv.at(-1)?.close ?? 0, updatedAt: Date.now(), loading: false, error: null });
        } catch {
          setSignal(pair.id, { pairId: pair.id, pairName: pair.name, market: pair.market, exchange: pair.exchange, signal: WAIT_SIGNAL, levels: null, strategy: null, price: 0, updatedAt: Date.now(), loading: false, error: 'Data unavailable' });
        }
        done++;
        setLoadedCount(done);
      })
    );
    setLastRefresh(Date.now());
    setLoading(false);
    setRefreshing(false);
  }, [setSignal, setLastRefresh]);

  const handleRefresh = useCallback(() => {
    setCountdown(300);
    load();
  }, [load]);

  useEffect(() => {
    load();
    const cdId = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { load(); return 300; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(cdId);
  }, [load]);

  const list = Object.values(signals).filter(Boolean) as PairSignal[];
  const filtered = marketFilter === 'all' ? list : list.filter(s => s.market === marketFilter);
  const sorted = [...filtered].sort((a, b) =>
    sortBy === 'confidence'
      ? b.signal.confidence - a.signal.confidence
      : ({'BUY':0,'SELL':1,'WAIT':2}[a.signal.signal] ?? 2) - ({'BUY':0,'SELL':1,'WAIT':2}[b.signal.signal] ?? 2)
  );
  const displayed = sorted.slice(0, page * PAGE);

  const buys  = list.filter(s => s.signal.signal === 'BUY').length;
  const sells = list.filter(s => s.signal.signal === 'SELL').length;
  const waits = list.filter(s => s.signal.signal === 'WAIT').length;

  const sColor: Record<string, string> = {
    BUY:  'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    SELL: 'text-red-400 bg-red-500/10 border-red-500/20',
    WAIT: 'text-slate-600 bg-transparent border-transparent',
  };

  const markets = ['all', 'crypto', 'forex', 'stocks', 'indices', 'commodities'];

  // Market status for each category
  const mStatus = (m: string) => m === 'all' ? null : getMarketStatus(m);

  return (
    <div className="bg-white/2 border border-white/8 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-white/5">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <h2 className="font-semibold text-white">Signal Feed</h2>
            {loading ? (
              <span className="text-xs text-slate-500 flex items-center gap-1.5">
                <span className="w-3 h-3 border border-slate-500 border-t-emerald-400 rounded-full animate-spin inline-block" />
                {loadedCount}/{PAIRS.length}
              </span>
            ) : (
              <div className="flex items-center gap-1.5 text-xs text-slate-600">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-mono">{String(Math.floor(countdown/60)).padStart(2,'0')}:{String(countdown%60).padStart(2,'0')}</span>
                <button
                  onClick={handleRefresh}
                  disabled={refreshing}
                  className="text-slate-500 hover:text-emerald-400 cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed p-1 rounded hover:bg-white/5"
                  title="Refresh now">
                  <svg className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </div>
            )}
          </div>
          {/* Market breadth */}
          <div className="flex items-center gap-3 text-xs">
            <span className="text-emerald-400 font-medium">{buys} BUY</span>
            <span className="text-red-400 font-medium">{sells} SELL</span>
            <span className="text-slate-600">{waits} WAIT</span>
            <div className="w-24 h-1.5 bg-white/5 rounded-full overflow-hidden flex">
              {buys + sells > 0 && <>
                <div className="h-full bg-emerald-500 transition-all" style={{ width: `${(buys / (buys + sells)) * 100}%` }} />
                <div className="h-full bg-red-500 transition-all" style={{ width: `${(sells / (buys + sells)) * 100}%` }} />
              </>}
            </div>
          </div>
          <select value={sortBy} onChange={e => setSortBy(e.target.value as 'confidence' | 'signal')}
            className="text-xs bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-slate-400 cursor-pointer">
            <option value="confidence">Sort: Confidence</option>
            <option value="signal">Sort: Signal</option>
          </select>
        </div>

        {/* Market filter tabs with open/closed status */}
        <div className="flex gap-1.5 flex-wrap">
          {markets.map(m => {
            const st = mStatus(m);
            const count = m === 'all' ? list.length : list.filter(s => s.market === m).length;
            return (
              <button key={m} onClick={() => { setMarketFilter(m); setPage(1); }}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs capitalize cursor-pointer transition-all duration-150 border ${
                  marketFilter === m
                    ? 'bg-white/10 text-white border-white/15'
                    : 'text-slate-500 border-transparent hover:text-slate-300'
                }`}>
                {/* Open/closed dot */}
                {st && (
                  <span className={`inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                    m === 'crypto' ? 'bg-emerald-400' :
                    st.isOpen ? 'bg-emerald-400 animate-pulse' : 'bg-red-500'
                  }`} />
                )}
                <span>{m}</span>
                {m !== 'all' && (
                  <>
                    <span className="text-slate-600">{count}</span>
                    {st && (
                      <span className={`text-xs px-1 py-0.5 rounded border text-[10px] leading-none ${st.color}`}>
                        {st.label}
                      </span>
                    )}
                  </>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/5">
              {['Pair', 'Exchange', 'Market', 'Status', 'Strategy', 'Signal', 'Confidence', 'Entry', 'TP1', 'SL', 'R:R', 'Action'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayed.map(row => {
              const st = getMarketStatus(row.market);
              return (
                <tr key={row.pairId} className="border-b border-white/3 hover:bg-white/3 transition-colors duration-150">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: MARKET_COLORS[row.market] }} />
                      <span className="font-mono font-medium text-white text-xs">{row.pairName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border whitespace-nowrap ${
                      row.exchange === 'Binance'       ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' :
                      row.exchange === 'Yahoo Finance' ? 'text-blue-400 bg-blue-500/10 border-blue-500/20' :
                      row.exchange === 'Frankfurter'   ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' :
                      'text-slate-400 bg-white/5 border-white/8'
                    }`}>{row.exchange ?? '—'}</span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-500 capitalize text-xs">{row.market}</td>
                  <td className="px-4 py-2.5">
                    <span className={`px-1.5 py-0.5 rounded border text-[10px] font-medium whitespace-nowrap ${st.color}`}>
                      {row.market === 'crypto' ? '24/7' : st.label}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    {row.strategy && <span className="px-1.5 py-0.5 rounded text-xs bg-blue-500/10 text-blue-400 border border-blue-500/15 whitespace-nowrap">{row.strategy.chipLabel}</span>}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold border ${sColor[row.signal.signal]}`}>{row.signal.signal}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-14 h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${row.signal.confidence >= 70 ? 'bg-emerald-500' : row.signal.confidence >= 50 ? 'bg-amber-500' : 'bg-slate-600'}`}
                          style={{ width: `${row.signal.confidence}%` }} />
                      </div>
                      <span className="text-xs font-mono text-slate-400 w-7">{row.signal.confidence}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-blue-300">{row.levels?.entry ?? '—'}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-emerald-400">{row.levels?.tp1 ?? '—'}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-red-400">{row.levels?.sl ?? '—'}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-400">{row.levels ? `1:${row.levels.rr}` : '—'}</td>
                  <td className="px-4 py-2.5">
                    <Link href={`/chart/${row.pairId}`}
                      className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/8 text-xs text-slate-400 hover:text-white transition-all duration-150 cursor-pointer whitespace-nowrap">
                      Chart →
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {sorted.length === 0 && !loading && (
          <div className="py-12 text-center text-slate-500 text-sm">No signals loaded yet</div>
        )}
      </div>

      {/* Show more */}
      {sorted.length > displayed.length && (
        <div className="border-t border-white/5 px-5 py-3 flex items-center justify-between">
          <span className="text-xs text-slate-500">Showing {displayed.length} of {sorted.length}</span>
          <button onClick={() => setPage(p => p + 1)}
            className="px-4 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/8 text-xs text-slate-400 hover:text-white transition-all cursor-pointer">
            Show more
          </button>
        </div>
      )}
    </div>
  );
}
