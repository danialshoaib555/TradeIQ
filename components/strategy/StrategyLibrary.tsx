'use client';
import { useState, useMemo } from 'react';
import Link from 'next/link';
import { STRATEGY_KEYS, STRATEGY_META, CATEGORY_META, type StrategyKey, type StrategyCategory, type Difficulty } from '@/lib/backtester';

const DIFFICULTY_STYLE: Record<Difficulty, string> = {
  beginner:     'text-emerald-400 bg-emerald-500/10 border-emerald-500/25',
  intermediate: 'text-amber-400 bg-amber-500/10 border-amber-500/25',
  advanced:     'text-red-400 bg-red-500/10 border-red-500/25',
};

const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  beginner:     'Beginner',
  intermediate: 'Intermediate',
  advanced:     'Advanced',
};

const WIN_RATE_EXAMPLES: Record<StrategyKey, { pair: string; result: string }[]> = {
  ema_cross:      [{ pair: 'EUR/USD', result: '72%' }, { pair: 'BTC/USD', result: '69%' }],
  trend_pullback: [{ pair: 'GBP/USD', result: '68%' }, { pair: 'ETH/USD', result: '65%' }],
  supertrend:     [{ pair: 'XAU/USD', result: '65%' }, { pair: 'BTC/USD', result: '63%' }],
  ma_ribbon:      [{ pair: 'NAS100', result: '70%' }, { pair: 'EUR/USD', result: '68%' }],
  rsi_divergence: [{ pair: 'GBP/JPY', result: '67%' }, { pair: 'SOL/USD', result: '64%' }],
  double_bottom:  [{ pair: 'XAU/USD', result: '65%' }, { pair: 'EUR/USD', result: '63%' }],
  head_shoulders: [{ pair: 'SPX500', result: '63%' }, { pair: 'BTC/USD', result: '60%' }],
  pin_bar:        [{ pair: 'USD/JPY', result: '66%' }, { pair: 'XAU/USD', result: '64%' }],
  engulfing:      [{ pair: 'EUR/GBP', result: '64%' }, { pair: 'ETH/USD', result: '62%' }],
  bb_squeeze:     [{ pair: 'BTC/USD', result: '65%' }, { pair: 'EUR/USD', result: '63%' }],
  donchian:       [{ pair: 'WTI/USD', result: '62%' }, { pair: 'BTC/USD', result: '60%' }],
  orb:            [{ pair: 'NAS100', result: '60%' }, { pair: 'EUR/USD', result: '58%' }],
  order_block:    [{ pair: 'XAU/USD', result: '70%' }, { pair: 'BTC/USD', result: '68%' }],
  liquidity_grab: [{ pair: 'EUR/USD', result: '68%' }, { pair: 'XAU/USD', result: '66%' }],
  fvg:            [{ pair: 'BTC/USD', result: '66%' }, { pair: 'GBP/USD', result: '64%' }],
  structure_break:[{ pair: 'EUR/USD', result: '69%' }, { pair: 'NAS100', result: '67%' }],
  macd_cross:     [{ pair: 'GBP/USD', result: '66%' }, { pair: 'ETH/USD', result: '64%' }],
  stoch_rsi:      [{ pair: 'BTC/USD', result: '64%' }, { pair: 'XAU/USD', result: '62%' }],
  vpa:            [{ pair: 'BTC/USD', result: '67%' }, { pair: 'NAS100', result: '65%' }],
  rsi_reversal:   [{ pair: 'EUR/JPY', result: '68%' }, { pair: 'XAU/USD', result: '66%' }],
  keltner:        [{ pair: 'EUR/USD', result: '63%' }, { pair: 'BTC/USD', result: '61%' }],
  news_trade:     [{ pair: 'EUR/USD', result: '58%' }, { pair: 'XAU/USD', result: '56%' }],
  news_confluence:[{ pair: 'GBP/USD', result: '61%' }, { pair: 'NAS100', result: '59%' }],
  mtf_analysis:   [{ pair: 'BTC/USD', result: '72%' }, { pair: 'EUR/USD', result: '70%' }],
  weekly_level:   [{ pair: 'XAU/USD', result: '70%' }, { pair: 'SPX500', result: '68%' }],
};

export default function StrategyLibrary() {
  const [catFilter, setCatFilter] = useState<StrategyCategory | 'all'>('all');
  const [diffFilter, setDiffFilter] = useState<Difficulty | 'all'>('all');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<StrategyKey | null>(null);

  const filtered = useMemo(() => {
    return STRATEGY_KEYS.filter(key => {
      const meta = STRATEGY_META[key];
      if (catFilter !== 'all' && meta.category !== catFilter) return false;
      if (diffFilter !== 'all' && meta.difficulty !== diffFilter) return false;
      if (search && !meta.name.toLowerCase().includes(search.toLowerCase()) &&
          !meta.shortDesc.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [catFilter, diffFilter, search]);

  const categories = Object.entries(CATEGORY_META) as [StrategyCategory, { label: string; color: string }][];

  const stats = useMemo(() => ({
    total: STRATEGY_KEYS.length,
    beginner: STRATEGY_KEYS.filter(k => STRATEGY_META[k].difficulty === 'beginner').length,
    intermediate: STRATEGY_KEYS.filter(k => STRATEGY_META[k].difficulty === 'intermediate').length,
    advanced: STRATEGY_KEYS.filter(k => STRATEGY_META[k].difficulty === 'advanced').length,
  }), []);

  return (
    <div className="space-y-5">
      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total Strategies', value: stats.total, color: 'text-white' },
          { label: 'Beginner', value: stats.beginner, color: 'text-emerald-400' },
          { label: 'Intermediate', value: stats.intermediate, color: 'text-amber-400' },
          { label: 'Advanced', value: stats.advanced, color: 'text-red-400' },
        ].map(s => (
          <div key={s.label} className="bg-white/3 border border-white/8 rounded-xl p-3 text-center">
            <div className={`text-2xl font-bold font-mono ${s.color}`}>{s.value}</div>
            <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white/2 border border-white/8 rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Search */}
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search strategies…"
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder-slate-500 outline-none focus:border-emerald-500/50 w-48"
          />
          {/* Difficulty */}
          <div className="flex items-center gap-1">
            {(['all', 'beginner', 'intermediate', 'advanced'] as const).map(d => (
              <button key={d} onClick={() => setDiffFilter(d)}
                className={`px-2.5 py-1 rounded-lg text-xs capitalize cursor-pointer border transition-all ${
                  diffFilter === d ? 'bg-white/10 text-white border-white/15' : 'text-slate-500 border-transparent hover:text-slate-300'
                }`}>
                {d === 'all' ? 'All Levels' : DIFFICULTY_LABEL[d]}
              </button>
            ))}
          </div>
          <span className="text-xs text-slate-600 ml-auto">{filtered.length} of {stats.total} strategies</span>
        </div>

        {/* Category tabs */}
        <div className="flex gap-1 flex-wrap">
          <button onClick={() => setCatFilter('all')}
            className={`px-2.5 py-1 rounded-lg text-xs cursor-pointer border transition-all ${
              catFilter === 'all' ? 'bg-white/10 text-white border-white/15' : 'text-slate-500 border-transparent hover:text-slate-300'
            }`}>
            All Categories
          </button>
          {categories.map(([cat, meta]) => (
            <button key={cat} onClick={() => setCatFilter(cat)}
              className={`px-2.5 py-1 rounded-lg text-xs cursor-pointer border transition-all ${
                catFilter === cat ? 'bg-white/10 text-white border-white/15' : 'text-slate-500 border-transparent hover:text-slate-300'
              }`}>
              <span className="inline-block w-1.5 h-1.5 rounded-full mr-1" style={{ backgroundColor: meta.color }} />
              {meta.label}
            </button>
          ))}
        </div>
      </div>

      {/* Strategy grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(key => {
          const meta = STRATEGY_META[key];
          const catMeta = CATEGORY_META[meta.category];
          const isOpen = expanded === key;
          const examples = WIN_RATE_EXAMPLES[key] ?? [];

          return (
            <div key={key}
              className={`bg-white/3 border rounded-xl overflow-hidden transition-all duration-200 ${
                isOpen ? 'border-white/20 shadow-lg' : 'border-white/8 hover:border-white/15'
              }`}>
              {/* Card header */}
              <div className="p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: meta.color }} />
                    <h3 className="font-medium text-white text-sm leading-tight">{meta.name}</h3>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-xs border flex-shrink-0 ${DIFFICULTY_STYLE[meta.difficulty]}`}>
                    {DIFFICULTY_LABEL[meta.difficulty]}
                  </span>
                </div>

                <p className="text-xs text-slate-400 mb-3">{meta.shortDesc}</p>

                {/* Category + win rate */}
                <div className="flex items-center justify-between">
                  <span className="text-xs px-2 py-0.5 rounded-full border" style={{ color: catMeta.color, borderColor: catMeta.color + '30', backgroundColor: catMeta.color + '10' }}>
                    {catMeta.label}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <div className="w-16 h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${meta.winRateEst}%`, backgroundColor: meta.winRateEst >= 65 ? '#22C55E' : meta.winRateEst >= 60 ? '#F59E0B' : '#EF4444' }} />
                    </div>
                    <span className={`text-xs font-mono font-bold ${meta.winRateEst >= 65 ? 'text-emerald-400' : meta.winRateEst >= 60 ? 'text-amber-400' : 'text-red-400'}`}>
                      ~{meta.winRateEst}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Indicators */}
              <div className="px-4 pb-3 flex gap-1 flex-wrap">
                {meta.indicators.map(ind => (
                  <span key={ind} className="px-1.5 py-0.5 rounded text-xs bg-white/6 text-slate-400 border border-white/8">
                    {ind}
                  </span>
                ))}
              </div>

              {/* Expand button */}
              <button
                onClick={() => setExpanded(isOpen ? null : key)}
                className="w-full px-4 py-2 border-t border-white/5 text-xs text-slate-500 hover:text-slate-300 hover:bg-white/3 transition-all flex items-center justify-between cursor-pointer">
                <span>{isOpen ? 'Show less' : 'View details'}</span>
                <svg className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Expanded details */}
              {isOpen && (
                <div className="px-4 pb-4 space-y-3 border-t border-white/5 pt-3">
                  <div>
                    <p className="text-xs font-medium text-slate-400 mb-1">Best for</p>
                    <p className="text-xs text-slate-300">{meta.bestFor}</p>
                  </div>

                  {/* Typical win rates */}
                  {examples.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-slate-400 mb-1.5">Typical performance</p>
                      <div className="space-y-1">
                        {examples.map(ex => (
                          <div key={ex.pair} className="flex items-center justify-between text-xs">
                            <span className="text-slate-400 font-mono">{ex.pair}</span>
                            <span className="text-emerald-400 font-mono font-medium">{ex.result}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Link
                      href="/chart/eurusd"
                      className="flex-1 py-2 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/25 text-xs text-emerald-400 text-center transition-all cursor-pointer">
                      Test on Chart →
                    </Link>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="col-span-3 py-16 text-center text-slate-500">
            <p className="text-sm">No strategies match your filters</p>
            <button onClick={() => { setCatFilter('all'); setDiffFilter('all'); setSearch(''); }}
              className="mt-3 text-xs text-emerald-400 hover:text-emerald-300 cursor-pointer">
              Clear filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
