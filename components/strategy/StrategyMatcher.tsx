'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PAIRS, MARKET_COLORS } from '@/lib/pairConfig';
import { calculateSignal } from '@/lib/signalEngine';
import { calculateLevels } from '@/lib/levelCalculator';
import { getBestStrategy, type Strategy } from '@/lib/strategyMatcher';
import type { SignalResult } from '@/lib/signalEngine';
import type { TradeLevels } from '@/lib/levelCalculator';

interface PairData { pairId: string; pairName: string; market: string; signal: SignalResult; levels: TradeLevels | null; best: Strategy; ranked: Strategy[]; }

export default function StrategyMatcher() {
  const [pairData, setPairData] = useState<PairData[]>([]);
  const [selected, setSelected] = useState<PairData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const results: PairData[] = [];
      await Promise.allSettled(PAIRS.slice(0, 12).map(async pair => {
        try {
          const res = await fetch(`/api/ohlcv/${pair.id}?tf=1h`);
          if (!res.ok) return;
          const ohlcv = await res.json();
          if (!Array.isArray(ohlcv) || ohlcv.length < 30) return;
          const signal = calculateSignal(ohlcv);
          const levels = calculateLevels(ohlcv, signal.signal, pair);
          const { best, ranked } = getBestStrategy(signal);
          results.push({ pairId: pair.id, pairName: pair.name, market: pair.market, signal, levels, best, ranked });
        } catch { /* skip */ }
      }));
      setPairData(results);
      if (results.length > 0) setSelected(results[0]);
      setLoading(false);
    };
    load();
  }, []);

  const sc: Record<string, string> = { BUY: 'text-emerald-400', SELL: 'text-red-400', WAIT: 'text-slate-500' };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="bg-white/2 border border-white/8 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-white/5"><h2 className="font-semibold text-white text-sm">Pairs</h2></div>
        {loading ? (
          <div className="p-4 space-y-2">{[...Array(8)].map((_, i) => <div key={i} className="h-12 bg-white/5 rounded-lg animate-pulse" />)}</div>
        ) : (
          <div className="divide-y divide-white/3">
            {pairData.map(p => (
              <button key={p.pairId} onClick={() => setSelected(p)}
                className={`w-full flex items-center justify-between px-4 py-3 cursor-pointer transition-all duration-150 ${selected?.pairId === p.pairId ? 'bg-white/6' : 'hover:bg-white/3'}`}>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: MARKET_COLORS[p.market] }} />
                  <span className="font-mono text-sm font-medium text-white">{p.pairName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-1.5 py-0.5 rounded text-xs bg-blue-500/10 text-blue-400 border border-blue-500/15">{p.best.chipLabel}</span>
                  <span className={`text-xs font-bold ${sc[p.signal.signal]}`}>{p.signal.signal}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="lg:col-span-2 space-y-4">
        {selected ? (
          <>
            <div className="bg-white/2 border border-white/8 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="font-bold text-lg text-white font-mono">{selected.pairName}</h2>
                  <p className="text-sm text-slate-400">Best match: <span className="text-blue-400">{selected.best.name}</span></p>
                </div>
                <Link href={`/chart/${selected.pairId}`} className="px-3 py-2 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/25 rounded-lg text-sm text-emerald-400 cursor-pointer transition-all">
                  View Chart
                </Link>
              </div>
              {selected.levels && selected.signal.signal !== 'WAIT' && (
                <div className="grid grid-cols-4 gap-2 mb-4">
                  {[
                    { l: 'Entry', v: selected.levels.entry, c: 'text-blue-300' },
                    { l: 'TP1', v: selected.levels.tp1, c: 'text-emerald-400' },
                    { l: 'SL', v: selected.levels.sl, c: 'text-red-400' },
                    { l: 'R:R', v: `1:${selected.levels.rr}`, c: 'text-white' },
                  ].map(item => (
                    <div key={item.l} className="bg-white/3 rounded-xl p-3 border border-white/5 text-center">
                      <div className="text-xs text-slate-500 mb-1">{item.l}</div>
                      <div className={`font-mono font-bold text-sm ${item.c}`}>{item.v}</div>
                    </div>
                  ))}
                </div>
              )}
              <div className="bg-blue-500/5 border border-blue-500/15 rounded-xl p-4">
                <p className="text-sm text-slate-300">{selected.best.explanation}</p>
              </div>
            </div>

            <div className="bg-white/2 border border-white/8 rounded-2xl overflow-hidden">
              <div className="px-5 py-3 border-b border-white/5"><h3 className="font-semibold text-white text-sm">All Strategies Ranked</h3></div>
              <div className="divide-y divide-white/3">
                {selected.ranked.map((strat, i) => (
                  <div key={strat.key} className={`p-4 ${i === 0 ? 'bg-emerald-500/3' : ''}`}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        {i === 0 && <span className="text-xs bg-emerald-500/15 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/20">Best</span>}
                        <span className="font-medium text-sm text-white">{strat.name}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-500">
                        <span>WR: <span className="text-white">{strat.winRate}%</span></span>
                        <span>PF: <span className="text-white">{strat.profitFactor}</span></span>
                        <div className="w-16 h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500/60 rounded-full" style={{ width: `${strat.matchScore}%` }} />
                        </div>
                        <span>{strat.matchScore}%</span>
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 mb-2">{strat.bestSessions}</p>
                    <Link href={`/learn/${strat.key}`} className="text-xs text-blue-400 hover:text-blue-300 cursor-pointer transition-colors">
                      Learn {strat.name} →
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="bg-white/2 border border-white/8 rounded-2xl p-12 text-center text-slate-500">
            {loading ? 'Loading pairs...' : 'Select a pair to see strategy analysis'}
          </div>
        )}
      </div>
    </div>
  );
}
