'use client';
import { useEffect, useState, useRef } from 'react';
import { use } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import Sidebar from '@/components/layout/Sidebar';
import TopBar from '@/components/layout/TopBar';
import SignalOverlay from '@/components/chart/SignalOverlay';
import { PAIRS, getPairById, MARKET_COLORS } from '@/lib/pairConfig';
import { calculateSignal, type SignalResult, type OHLCV } from '@/lib/signalEngine';
import { calculateLevels, type TradeLevels } from '@/lib/levelCalculator';
import { getBestStrategy, type Strategy } from '@/lib/strategyMatcher';

const LiveChart = dynamic(() => import('@/components/chart/LiveChart'), { ssr: false });

const TFS = ['5m', '15m', '1h', '4h', '1D'] as const;
type TF = typeof TFS[number];

export default function ChartPage({ params }: { params: Promise<{ pair: string }> }) {
  const { pair: pairId } = use(params);
  const pair = getPairById(pairId);
  const router = useRouter();

  const [tf, setTf] = useState<TF>('1h');
  const [tradeType, setTradeType] = useState<'auto' | 'long' | 'short'>('auto');
  const [ohlcv, setOhlcv] = useState<OHLCV[]>([]);
  const [signal, setSignal] = useState<SignalResult | null>(null);
  const [levels, setLevels] = useState<TradeLevels | null>(null);
  const [forcedLevels, setForcedLevels] = useState<TradeLevels | null>(null);
  const [strategy, setStrategy] = useState<Strategy | null>(null);
  const [showEMA, setShowEMA] = useState(true);
  const [showBB, setShowBB] = useState(false);

  // Pair search state
  const [search, setSearch] = useState('');
  const [showDrop, setShowDrop] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  // Fetch OHLCV & compute signal when pair/tf changes
  useEffect(() => {
    if (!pair) return;
    setOhlcv([]); setSignal(null); setLevels(null); setForcedLevels(null);
    fetch(`/api/ohlcv/${pairId}?tf=${tf}`)
      .then(r => r.json())
      .then(data => {
        if (!Array.isArray(data) || data.length < 30) return;
        setOhlcv(data);
        const sig = calculateSignal(data);
        setSignal(sig);
        const { best } = getBestStrategy(sig);
        setStrategy(best);
      })
      .catch(() => {});
  }, [pairId, tf, pair]);

  // Recalculate levels when signal OR tradeType changes
  useEffect(() => {
    if (!signal || ohlcv.length === 0 || !pair) return;
    // Auto levels follow the signal
    setLevels(calculateLevels(ohlcv, signal.signal, pair));
    // Forced levels follow the manual direction
    const forcedDir = tradeType === 'long' ? 'BUY' : tradeType === 'short' ? 'SELL' : signal.signal;
    setForcedLevels(calculateLevels(ohlcv, forcedDir, pair));
  }, [signal, tradeType, ohlcv, pair]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setShowDrop(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filteredPairs = PAIRS.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.id.toLowerCase().includes(search.toLowerCase())
  );

  if (!pair) return (
    <div className="flex h-screen items-center justify-center bg-[#020617]">
      <div className="text-center">
        <p className="text-slate-400 mb-4">Pair not found</p>
        <Link href="/" className="text-emerald-400 hover:text-emerald-300 text-sm">← Back to dashboard</Link>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-[#020617]">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar />
        <div className="flex-1 flex overflow-hidden">
          {/* ── Chart area ── */}
          <div className="flex-1 flex flex-col p-4 gap-3 overflow-hidden min-w-0">
            {/* Toolbar */}
            <div className="flex items-center gap-3 flex-shrink-0 flex-wrap">
              {/* Pair search/selector */}
              <div ref={dropRef} className="relative">
                <button
                  onClick={() => { setShowDrop(v => !v); setSearch(''); }}
                  className="flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/10 rounded-xl hover:bg-white/8 transition-all cursor-pointer min-w-[140px]"
                >
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: MARKET_COLORS[pair.market] }} />
                  <span className="font-mono font-bold text-white text-sm">{pair.name}</span>
                  <svg className="w-3.5 h-3.5 text-slate-500 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showDrop && (
                  <div className="absolute top-full left-0 mt-1 w-64 bg-slate-900 border border-white/12 rounded-xl shadow-2xl z-50 overflow-hidden">
                    <div className="p-2 border-b border-white/8">
                      <input
                        autoFocus
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search pairs…"
                        className="w-full bg-white/5 border border-white/8 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-emerald-500/50"
                      />
                    </div>
                    <div className="max-h-72 overflow-y-auto">
                      {filteredPairs.slice(0, 50).map(p => (
                        <button key={p.id} onClick={() => { router.push(`/chart/${p.id}`); setShowDrop(false); }}
                          className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left cursor-pointer hover:bg-white/5 transition-colors ${p.id === pairId ? 'bg-white/8 text-white' : 'text-slate-300'}`}>
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: MARKET_COLORS[p.market] }} />
                          <span className="font-mono font-medium">{p.name}</span>
                          <span className="text-xs text-slate-500 ml-auto capitalize">{p.market}</span>
                        </button>
                      ))}
                      {filteredPairs.length === 0 && (
                        <div className="py-6 text-center text-slate-500 text-sm">No pairs found</div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Spacer */}
              <div className="flex-1" />

              {/* EMA/BB toggles */}
              <div className="flex items-center gap-1.5">
                {[
                  { label: 'EMA', active: showEMA, toggle: () => setShowEMA(v => !v), color: 'border-blue-500/30 bg-blue-500/20 text-blue-400' },
                  { label: 'BB',  active: showBB,  toggle: () => setShowBB(v => !v),  color: 'border-purple-500/30 bg-purple-500/20 text-purple-400' },
                ].map(o => (
                  <button key={o.label} onClick={o.toggle}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all duration-150 border ${o.active ? o.color : 'bg-white/5 text-slate-500 border-white/8 hover:bg-white/8'}`}>
                    {o.label}
                  </button>
                ))}
              </div>

              {/* Timeframes */}
              <div className="flex items-center gap-1 bg-white/3 border border-white/6 rounded-xl p-1">
                {TFS.map(t => (
                  <button key={t} onClick={() => setTf(t)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium cursor-pointer transition-all duration-150 ${tf === t ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'text-slate-500 hover:text-slate-300'}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Chart */}
            <div className="flex-1 bg-white/2 border border-white/8 rounded-2xl overflow-hidden">
              <LiveChart
                pair={pair}
                levels={tradeType === 'auto' ? levels : forcedLevels}
                signal={signal}
                tradeType={tradeType}
                showEMA={showEMA}
                showBB={showBB}
                timeframe={tf}
              />
            </div>
          </div>

          {/* ── Signal panel ── */}
          <div className="w-72 flex-shrink-0 border-l border-white/5 overflow-y-auto p-4 bg-slate-900/40">
            {signal ? (
              <SignalOverlay
                signal={signal}
                levels={levels}
                forcedLevels={forcedLevels}
                strategy={strategy}
                tradeType={tradeType}
                onTradeTypeChange={setTradeType}
              />
            ) : (
              <div className="flex items-center justify-center h-48 text-slate-500">
                <div className="text-center">
                  <div className="w-6 h-6 border-2 border-slate-500 border-t-emerald-400 rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-sm">Analyzing {pair.name}…</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
