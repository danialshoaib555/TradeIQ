'use client';
import { useMemo } from 'react';
import type { BacktestResult } from '@/lib/backtester';
import { STRATEGY_META, STRATEGY_KEYS, type StrategyKey } from '@/lib/backtester';
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

export default function StrategyPanel({ results, selectedStrategy, onSelect, signal, loading, candles }: Props) {
  // Sort strategies by backtest win rate (only those with trades)
  const sorted = useMemo(() => {
    if (!results) return [...STRATEGY_KEYS];
    return [...STRATEGY_KEYS].sort((a, b) => {
      const ar = results[a];
      const br = results[b];
      if (ar.totalTrades === 0 && br.totalTrades === 0) return 0;
      if (ar.totalTrades === 0) return 1;
      if (br.totalTrades === 0) return -1;
      // Sort by expectancy
      return br.expectancy - ar.expectancy;
    });
  }, [results]);

  // Which strategy currently has an active AI signal
  const activeBySignal = useMemo(() => {
    if (!signal || signal.signal === 'WAIT') return null;
    const { best } = getBestStrategy(signal);
    return best?.key as StrategyKey | null;
  }, [signal]);

  const best = sorted[0];

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
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-slate-300">Strategy Backtester</p>
          <p className="text-xs text-slate-600 mt-0.5">
            {candles} candles · {results?.[sorted[0]]?.totalTrades ?? 0} trades avg
          </p>
        </div>
        {results && results[best]?.totalTrades > 0 && (
          <div className="px-2 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/25 text-xs text-emerald-400 font-medium">
            Best: {STRATEGY_META[best].name.split(' ')[0]}
          </div>
        )}
      </div>

      <div className="space-y-2">
        {sorted.map((key) => {
          const meta    = STRATEGY_META[key];
          const res     = results?.[key];
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
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: meta.color }} />
                  <span className={`text-sm font-medium truncate ${isActive ? 'text-white' : 'text-slate-300'}`}>{meta.name}</span>
                  {isBest   && <span className="px-1.5 py-0.5 rounded text-xs bg-amber-500/15 border border-amber-500/25 text-amber-400 flex-shrink-0">★ Best</span>}
                  {hasSignal && <span className="px-1.5 py-0.5 rounded text-xs bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 flex-shrink-0">Live</span>}
                </div>
                {isActive && (
                  <div className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                    <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </div>

              {/* Stats row */}
              {trades > 0 ? (
                <>
                  {/* Win rate bar */}
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${wr}%`, backgroundColor: wr >= 60 ? '#22C55E' : wr >= 50 ? '#F59E0B' : '#EF4444' }} />
                    </div>
                    <span className={`text-xs font-mono font-bold w-8 text-right ${wr >= 60 ? 'text-emerald-400' : wr >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
                      {wr}%
                    </span>
                  </div>
                  {/* Details */}
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span>{trades} trades</span>
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

              {/* Indicator tags */}
              {isActive && (
                <div className="flex gap-1 mt-2">
                  {meta.indicators.map(ind => (
                    <span key={ind} className="px-1.5 py-0.5 rounded text-xs bg-white/8 text-slate-400 border border-white/8">
                      {ind}
                    </span>
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="pt-2 border-t border-white/5 space-y-1">
        <p className="text-xs text-slate-600">Backtested on historical candles — past results don't guarantee future performance.</p>
        <div className="flex gap-3 text-xs text-slate-600">
          <span>★ = best expectancy</span>
          <span>Live = AI signal active</span>
        </div>
      </div>
    </div>
  );
}
