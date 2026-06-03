'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { usePairStore } from '@/store/usePairStore';
import { PAIRS, MARKET_COLORS } from '@/lib/pairConfig';

const MARKETS = ['all', 'forex', 'crypto', 'stocks', 'commodities'] as const;

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg> },
  { href: '/strategies', label: 'Strategies', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg> },
  { href: '/risk', label: 'Risk Calc', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg> },
  { href: '/calendar', label: 'Calendar', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg> },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { selectedMarket, setMarket, selectedPairId, setSelectedPair } = usePairStore();

  const filteredPairs = selectedMarket === 'all' ? PAIRS : PAIRS.filter(p => p.market === selectedMarket);

  return (
    <aside className="w-64 flex-shrink-0 bg-slate-900/80 backdrop-blur-xl border-r border-white/5 flex flex-col h-screen sticky top-0">
      <div className="p-4 border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
            <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <span className="font-bold text-lg text-white tracking-tight font-mono">Trade<span className="text-emerald-400">IQ</span></span>
        </div>
      </div>

      <nav className="p-3 border-b border-white/5">
        {NAV_ITEMS.map(item => (
          <Link key={item.href} href={item.href}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 cursor-pointer mb-1 ${
              pathname === item.href
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            {item.icon}
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="p-3 border-b border-white/5">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Market</p>
        <div className="flex flex-wrap gap-1">
          {MARKETS.map(m => (
            <button key={m} onClick={() => setMarket(m)}
              className={`px-2 py-1 rounded text-xs font-medium cursor-pointer transition-all duration-150 capitalize ${
                selectedMarket === m
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'text-slate-500 hover:text-slate-300 bg-transparent border border-transparent'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Pairs</p>
        <div className="space-y-0.5">
          {filteredPairs.map(pair => (
            <button key={pair.id} onClick={() => setSelectedPair(pair.id)}
              className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg text-sm cursor-pointer transition-all duration-150 ${
                selectedPairId === pair.id
                  ? 'bg-white/8 text-white border border-white/10'
                  : 'text-slate-400 hover:text-white hover:bg-white/4'
              }`}
            >
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: MARKET_COLORS[pair.market] }} />
              <span className="font-mono text-xs font-medium">{pair.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 border-t border-white/5">
        <p className="text-xs text-slate-600 text-center">Free · Open Source · No AI APIs</p>
      </div>
    </aside>
  );
}
