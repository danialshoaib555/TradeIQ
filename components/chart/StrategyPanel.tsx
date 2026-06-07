'use client';
import { useMemo, useState } from 'react';
import type { BacktestResult } from '@/lib/backtester';
import { STRATEGY_META, STRATEGY_KEYS, CATEGORY_META, type StrategyKey, type StrategyCategory } from '@/lib/backtester';
import type { SignalResult } from '@/lib/signalEngine';
import { getBestStrategy } from '@/lib/strategyMatcher';

interface Props {
  results: Record<StrategyKey, BacktestResult> | null;
  selectedStrategy: StrategyKey;
  onSelect: (key: StrategyKey) => void;
  signal: SignalResult | null;
  loading: boolean;
  candles: number;
}

const DIFFICULTY_COLOR: Record<string, string> = {
  beginner:     'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  intermediate: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  advanced:     'text-red-400 bg-red-500/10 border-red-500/20',
};

export default function StrategyPanel({ results, selectedStrategy, onSelect, signal, loading, candles }: Props) {
  const [catFilter, setCatFilter] = useState<StrategyCategory | 'all'>('all');

  const sorted = useMemo(() => {
    if (!results) return [...STRATEGY_KEYS];
    return [...STRATEGY_KEYS].sort((a, b) => {
      const ar = results[a];
      const br = results[b];
      if (ar.totalTrades === 0 && br.totalTrades === 0) return 0;
      if (ar.totalTrades === 0) return 1;
      if (br.totalTrades === 0) return -1;
      return br.expectancy - ar.expectancy;
    });
  }, [results]);

  const filtered = catFilter === 'all' ? sorted : sorted.filter(k => STRATEGY_META[k].category === catFilter);

  const activeBySignal = useMemo(() => {
    if (!signal || signal.signal === 'WAIT') return null;
    const { best } = getBestStrategy(signal);
    return best?.key as StrategyKey | null;
  }, [signal]);

  const best = sorted[0];

  const categories = Object.entries(CATEGORY_META) as [StrategyCategory, { label: string; color: string }][];

  if (loading) {
    return (
      <div className="space-y-3 animate-pulse">
        <div className="h-3 bg-white/5 rounded w-1/2" />
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-20 bg-white/5 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-slate-300">Strategy Backtester</p>
          <p className="text-xs text-slate-600 mt-0.5">
            {candles} candles · {STRATEGY_KEYS.length} strategies
          </p>
        </div>
        {results && results[best]?.totalTrades > 0 && (
          <div className="px-2 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/25 text-xs text-emerald-400 font-medium">
            ★ {STRATEGY_META[best].name.split(' ')[0]}
          </div>
        )}
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap gap-1">
        <button
          onClick={() => setCatFilter('all')}
          className={`px-2 py-0.5 rounded text-xs border transition-all cursor-pointer ${catFilter === 'all' ? 'bg-white/15 text-white border-white/20' : 'text-slate-500 border-transparent hover:text-slate-300'}`}>
          All
        </button>
        {categories.map(([cat, meta]) => (
          <button key={cat} onClick={() => setCatFilter(cat)}
            className={`px-2 py-0.5 rounded text-xs border transition-all cursor-pointer ${catFilter === cat ? 'bg-white/15 text-white border-white/20' : 'text-slate-500 border-transparent hover:text-slate-300'}`}>
            {meta.label}
          </button>
        ))}
      </div>

      {/* Strategy list */}
      <div className="space-y-2">
        {filtered.map((key) => {
          const meta     = STRATEGY_META[key];
          const res      = results?.[key];
          const isActive = selectedStrategy === key;
          const isBest   = key === best && (res?.totalTrades ?? 0) > 0;
          const hasSignal= key === activeBySignal;
          const wr       = res?.winRate ?? 0;
          const trades   = res?.totalTrades ?? 0;

          return (
            <button key={key} onClick={() => onSelect(key)}
              className={`w-full text-left p-3 rounded-xl border transition-all duration-150 cursor-pointer ${
                isActive
                  ? 'bg-white/8 border-white/20 shadow-lg'
                  : 'bg-white/3 border-white/6 hover:bg-white/6 hover:border-white/12'
              }`}>
              {/* Header row */}
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: meta.color }} />
                  <span className={`text-xs font-medium truncate ${isActive ? 'text-white' : 'text-slate-300'}`}>{meta.name}</span>
                  {isBest    && <span className="px-1 py-0.5 rounded text-xs bg-amber-500/15 border border-amber-500/25 text-amber-400 flex-shrink-0">★</span>}
                  {hasSignal && <span className="px-1 py-0.5 rounded text-xs bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 flex-shrink-0">Live</span>}
                </div>
                <span className={`px-1.5 py-0.5 rounded text-xs border flex-shrink-0 ${DIFFICULTY_COLOR[meta.difficulty]}`}>
                  {meta.difficulty[0].toUpperCase()}
                </span>
              </div>

              {/* Stats */}
              {trades > 0 ? (
                <>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${wr}%`, backgroundColor: wr >= 60 ? '#22C55E' : wr >= 50 ? '#F59E0B' : '#EF4444' }} />
                    </div>
                    <span className={`text-xs font-mono font-bold w-7 text-right ${wr >= 60 ? 'text-emerald-400' : wr >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
                      {wr}%
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span>{trades}T</span>
                    <span className="text-emerald-600">{res!.wins}W</span>
                    <span className="text-red-600">{res!.losses}L</span>
                    <span className="ml-auto">PF {res!.profitFactor}×</span>
                    <span className={`font-mono font-medium ${(res?.expectancy ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {(res!.expectancy >= 0 ? '+' : '')}{res!.expectancy}R
                    </span>
                  </div>
                </>
              ) : (
                <p className="text-xs text-slate-600">{meta.shortDesc} · no trades in range</p>
              )}

              {/* Indicator tags (when active) */}
              {isActive && (
                <div className="flex gap-1 mt-2 flex-wrap">
                  {meta.indicators.map(ind => (
                    <span key={ind} className="px-1.5 py-0.5 rounded text-xs bg-white/8 text-slate-400 border border-white/8">
                      {ind}
                    </span>
                  ))}
                  <span className="px-1.5 py-0.5 rounded text-xs bg-white/5 text-slate-500 border border-white/5 capitalize">
                    {meta.bestFor}
                  </span>
                </div>
              )}
            </button>
          );
        })}

        {filtered.length === 0 && (
          <div className="py-6 text-center text-slate-500 text-xs">No strategies in this category</div>
        )}
      </div>

      {/* Legend */}
      <div className="pt-2 border-t border-white/5 space-y-1">
        <p className="text-xs text-slate-600">Backtested on historical candles — past results don't guarantee future performance.</p>
        <div className="flex gap-3 text-xs text-slate-600 flex-wrap">
          <span>★ = best expectancy</span>
          <span>Live = AI signal active</span>
          <span className="text-emerald-600">B</span><span>=beginner</span>
          <span className="text-amber-600">I</span><span>=intermediate</span>
          <span className="text-red-600">A</span><span>=advanced</span>
        </div>
      </div>
    </div>
  );
}
