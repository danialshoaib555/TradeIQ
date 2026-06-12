'use client';
import { useState, useEffect } from 'react';
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

const FAV_KEY = 'tradeiq-favorites';

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { selectedMarket, setMarket, selectedPairId, setSelectedPair } = usePairStore();
  const [search, setSearch] = useState('');
  const [favorites, setFavorites] = useState<string[]>([]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(FAV_KEY);
      if (saved) setFavorites(JSON.parse(saved));
    } catch {}
  }, []);

  const toggleFavorite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorites(prev => {
      const next = prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id];
      try { localStorage.setItem(FAV_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const filteredPairs = PAIRS.filter(p => {
    const matchMarket = selectedMarket === 'all' || p.market === selectedMarket;
    const matchSearch = search === '' ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.id.toLowerCase().includes(search.toLowerCase());
    return matchMarket && matchSearch;
  });

  // Favorites pinned to top
  const sortedPairs = [
    ...filteredPairs.filter(p => favorites.includes(p.id)),
    ...filteredPairs.filter(p => !favorites.includes(p.id)),
  ];

  return (
    <>
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
          <Link key={item.href} href={item.href} onClick={onNavigate}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 cursor-pointer mb-0.5 ${
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
              className={`px-2 py-1 rounded text-xs font-medium cursor-pointer transition-all duration-150 capitalize border ${
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
          className="w-full bg-white/5 border border-white/8 rounded-lg px-2.5 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-emerald-500/40 transition-colors"
        />
      </div>

      {/* Pair count */}
      <div className="px-3 py-1 flex-shrink-0 flex items-center justify-between">
        <span className="text-xs text-slate-600">{filteredPairs.length} pairs</span>
        {favorites.length > 0 && (
          <span className="text-xs text-amber-500/70">★ {favorites.length}</span>
        )}
      </div>

      {/* Pairs list */}
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        <div className="space-y-0.5">
          {sortedPairs.map(p => {
            const isFav = favorites.includes(p.id);
            return (
              <button key={p.id} onClick={() => { setSelectedPair(p.id); onNavigate?.(); }}
                className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg text-sm cursor-pointer transition-all duration-150 group ${
                  selectedPairId === p.id
                    ? 'bg-white/8 text-white border border-white/10'
                    : 'text-slate-400 hover:text-white hover:bg-white/4'
                }`}>
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: MARKET_COLORS[p.market] }} />
                <span className="font-mono text-xs font-medium truncate">{p.name}</span>
                <span className="ml-auto flex items-center gap-0.5">
                  {/* Favorite star */}
                  <span onClick={e => toggleFavorite(p.id, e)}
                    className={`p-1 cursor-pointer transition-all ${
                      isFav ? 'text-amber-400' : 'text-slate-700 opacity-0 group-hover:opacity-100 hover:text-amber-400'
                    }`}
                    title={isFav ? 'Remove from watchlist' : 'Add to watchlist'}>
                    <svg className="w-3 h-3" fill={isFav ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.783-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                    </svg>
                  </span>
                  {/* Open chart */}
                  <Link href={`/chart/${p.id}`}
                    onClick={e => { e.stopPropagation(); onNavigate?.(); }}
                    className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-slate-300 transition-all p-1"
                    title="Open chart">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </Link>
                </span>
              </button>
            );
          })}
          {sortedPairs.length === 0 && (
            <p className="text-xs text-slate-600 text-center py-4">No pairs found</p>
          )}
        </div>
      </div>

      <div className="p-2 border-t border-white/5 flex-shrink-0">
        <p className="text-xs text-slate-700 text-center">{PAIRS.length} pairs · Free · No AI APIs</p>
      </div>
    </>
  );
}

export default function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  // Lock body scroll when mobile drawer open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-60 flex-shrink-0 bg-slate-900/80 backdrop-blur-xl border-r border-white/5 flex-col h-screen sticky top-0">
        <SidebarContent />
      </aside>

      {/* Mobile hamburger — fixed top-left */}
      <button onClick={() => setMobileOpen(true)}
        aria-label="Open menu"
        className="lg:hidden fixed top-3 left-3 z-40 w-11 h-11 flex items-center justify-center rounded-xl bg-slate-900/90 backdrop-blur-xl border border-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          {/* Drawer */}
          <aside className="absolute left-0 top-0 bottom-0 w-[280px] max-w-[85vw] bg-slate-900 border-r border-white/10 flex flex-col shadow-2xl">
            {/* Close button */}
            <button onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
              className="absolute top-3 right-3 z-10 w-9 h-9 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}
    </>
  );
}
