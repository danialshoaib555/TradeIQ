'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { usePairStore } from '@/store/usePairStore';
import { PAIRS, MARKET_COLORS, MARKETS } from '@/lib/pairConfig';

const NAV_ITEMS = [
  { href: '/',           label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { href: '/strategies', label: 'Strategies', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
  { href: '/risk',       label: 'Risk Calc',  icon: 'M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z' },
  { href: '/demo',       label: 'Demo Trade', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { selectedMarket, setMarket, selectedPairId, setSelectedPair } = usePairStore();
  const [search, setSearch] = useState('');

  const filteredPairs = PAIRS.filter(p => {
    const matchMarket = selectedMarket === 'all' || p.market === selectedMarket;
    const matchSearch = search === '' ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.id.toLowerCase().includes(search.toLowerCase());
    return matchMarket && matchSearch;
  });

  return (
    <aside className="w-60 flex-shrink-0 bg-slate-900/80 backdrop-blur-xl border-r border-white/5 flex flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="p-4 border-b border-white/5 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
            <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <span className="font-bold text-lg text-white tracking-tight font-mono">Trade<span className="text-emerald-400">IQ</span></span>
        </div>
      </div>

      {/* Nav */}
      <nav className="p-2 border-b border-white/5 flex-shrink-0">
        {NAV_ITEMS.map(item => (
          <Link key={item.href} href={item.href}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150 cursor-pointer mb-0.5 ${
              pathname === item.href
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}>
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
            </svg>
            {item.label}
          </Link>
        ))}
      </nav>

      {/* Market filter */}
      <div className="p-2 border-b border-white/5 flex-shrink-0">
        <div className="flex flex-wrap gap-1">
          {MARKETS.map(m => (
            <button key={m} onClick={() => setMarket(m)}
              className={`px-2 py-0.5 rounded text-xs font-medium cursor-pointer transition-all duration-150 capitalize border ${
                selectedMarket === m
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                  : 'text-slate-500 hover:text-slate-300 bg-transparent border-transparent'
              }`}>
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Search */}
      <div className="px-2 pt-2 flex-shrink-0">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search pairs…"
          className="w-full bg-white/5 border border-white/8 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 outline-none focus:border-emerald-500/40 transition-colors"
        />
      </div>

      {/* Pair count */}
      <div className="px-3 py-1 flex-shrink-0">
        <span className="text-xs text-slate-600">{filteredPairs.length} pairs</span>
      </div>

      {/* Pairs list */}
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        <div className="space-y-0.5">
          {filteredPairs.map(p => (
            <button key={p.id} onClick={() => setSelectedPair(p.id)}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm cursor-pointer transition-all duration-150 group ${
                selectedPairId === p.id
                  ? 'bg-white/8 text-white border border-white/10'
                  : 'text-slate-400 hover:text-white hover:bg-white/4'
              }`}>
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: MARKET_COLORS[p.market] }} />
              <span className="font-mono text-xs font-medium truncate">{p.name}</span>
              <Link href={`/chart/${p.id}`}
                onClick={e => e.stopPropagation()}
                className="ml-auto opacity-0 group-hover:opacity-100 text-slate-500 hover:text-slate-300 transition-all p-0.5"
                title="Open chart">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </Link>
            </button>
          ))}
          {filteredPairs.length === 0 && (
            <p className="text-xs text-slate-600 text-center py-4">No pairs found</p>
          )}
        </div>
      </div>

      <div className="p-2 border-t border-white/5 flex-shrink-0">
        <p className="text-xs text-slate-700 text-center">{PAIRS.length} pairs · Free · No AI APIs</p>
      </div>
    </aside>
  );
}
