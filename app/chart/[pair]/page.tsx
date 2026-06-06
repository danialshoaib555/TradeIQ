'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import { use } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import Sidebar from '@/components/layout/Sidebar';
import TopBar from '@/components/layout/TopBar';
import SignalOverlay from '@/components/chart/SignalOverlay';
import StrategyPanel from '@/components/chart/StrategyPanel';
import { PAIRS, getPairById, MARKET_COLORS } from '@/lib/pairConfig';
import { calculateSignal, type SignalResult, type OHLCV } from '@/lib/signalEngine';
import { calculateLevels, type TradeLevels } from '@/lib/levelCalculator';
import { getBestStrategy, type Strategy } from '@/lib/strategyMatcher';
import { runBacktest, STRATEGY_KEYS, type StrategyKey, type BacktestResult, type BacktestTrade } from '@/lib/backtester';

const LiveChart = dynamic(() => import('@/components/chart/LiveChart'), { ssr: false });

const TFS = ['5m', '15m', '1h', '4h', '1D'] as const;
type TF = typeof TFS[number];
type Tab = 'signal' | 'strategy';

export default function ChartPage({ params }: { params: Promise<{ pair: string }> }) {
  const { pair: pairId } = use(params);
  const pair = getPairById(pairId);
  const router = useRouter();

  const [tf, setTf]           = useState<TF>('1h');
  const [tab, setTab]         = useState<Tab>('signal');
  const [tradeType, setTradeType] = useState<'auto' | 'long' | 'short'>('auto');
  const [ohlcv, setOhlcv]     = useState<OHLCV[]>([]);
  const [signal, setSignal]   = useState<SignalResult | null>(null);
  const [levels, setLevels]   = useState<TradeLevels | null>(null);
  const [forcedLevels, setForcedLevels] = useState<TradeLevels | null>(null);
  const [strategy, setStrategy] = useState<Strategy | null>(null);

  // Strategy selector
  const [selectedStrategy, setSelectedStrategy] = useState<StrategyKey>('ema_cross');
  const [backtestResults, setBacktestResults]   = useState<Record<StrategyKey, BacktestResult> | null>(null);
  const [backtestLoading, setBacktestLoading]   = useState(false);
  const [activeTrades, setActiveTrades]         = useState<BacktestTrade[]>([]);

  // Pair search
  const [search, setSearch]     = useState('');
  const [showDrop, setShowDrop] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  // Auto-refresh countdown
  const [countdown, setCountdown] = useState(300);

  // Fetch OHLCV
  const fetchData = useCallback(async () => {
    if (!pair) return;
    setOhlcv([]);
    const res = await fetch(`/api/ohlcv/${pairId}?tf=${tf}`).catch(() => null);
    if (!res?.ok) return;
    const data = await res.json();
    if (Array.isArray(data) && data.length >= 30) {
      setOhlcv(data);
      const sig = calculateSignal(data);
      setSignal(sig);
      const { best } = getBestStrategy(sig);
      setStrategy(best);
    }
  }, [pair, pairId, tf]);

  useEffect(() => {
    setSignal(null); setLevels(null); setForcedLevels(null);
    setBacktestResults(null); setCountdown(300);
    fetchData();
  }, [fetchData]);

  // Countdown + auto-refresh
  useEffect(() => {
    const id = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { fetchData(); return 300; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [fetchData]);

  // Recalculate levels when signal/tradeType changes
  useEffect(() => {
    if (!signal || ohlcv.length === 0 || !pair) return;
    setLevels(calculateLevels(ohlcv, signal.signal, pair));
    const dir = tradeType === 'long' ? 'BUY' : tradeType === 'short' ? 'SELL' : signal.signal;
    setForcedLevels(calculateLevels(ohlcv, dir, pair));
  }, [signal, tradeType, ohlcv, pair]);

  // Run backtest when OHLCV loaded
  useEffect(() => {
    if (ohlcv.length < 40) return;
    setBacktestLoading(true);
    // Run in next tick to avoid blocking render
    const tid = setTimeout(() => {
      const results: Partial<Record<StrategyKey, BacktestResult>> = {};
      for (const key of STRATEGY_KEYS) {
        results[key] = runBacktest(ohlcv, key);
      }
      setBacktestResults(results as Record<StrategyKey, BacktestResult>);

      // Auto-select best strategy (highest expectancy with >3 trades)
      let bestKey: StrategyKey = 'ema_cross';
      let bestExp = -Infinity;
      for (const key of STRATEGY_KEYS) {
        const r = results[key]!;
        if (r.totalTrades >= 3 && r.expectancy > bestExp) {
          bestExp = r.expectancy; bestKey = key;
        }
      }
      setSelectedStrategy(bestKey);
      setBacktestLoading(false);
    }, 0);
    return () => clearTimeout(tid);
  }, [ohlcv]);

  // Update active backtest trades when strategy changes
  useEffect(() => {
    if (!backtestResults) return;
    setActiveTrades(backtestResults[selectedStrategy]?.trades ?? []);
  }, [selectedStrategy, backtestResults]);

  // Close dropdown on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => { if (dropRef.current && !dropRef.current.contains(e.target as Node)) setShowDrop(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const filteredPairs = PAIRS.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) || p.id.toLowerCase().includes(search.toLowerCase())
  );

  const mmSS = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

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
            <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
              {/* Pair selector */}
              <div ref={dropRef} className="relative">
                <button onClick={() => { setShowDrop(v => !v); setSearch(''); }}
                  className="flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/10 rounded-xl hover:bg-white/8 transition-all cursor-pointer min-w-[140px]">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: MARKET_COLORS[pair.market] }} />
                  <span className="font-mono font-bold text-white text-sm">{pair.name}</span>
                  <svg className="w-3.5 h-3.5 text-slate-500 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showDrop && (
                  <div className="absolute top-full left-0 mt-1 w-64 bg-slate-900 border border-white/12 rounded-xl shadow-2xl z-50 overflow-hidden">
                    <div className="p-2 border-b border-white/8">
                      <input autoFocus value={search} onChange={e => setSearch(e.target.value)}
                        placeholder="Search pairs…"
                        className="w-full bg-white/5 border border-white/8 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-emerald-500/50" />
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
                      {filteredPairs.length === 0 && <div className="py-6 text-center text-slate-500 text-sm">No pairs found</div>}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex-1" />

              {/* Auto-refresh timer */}
              <div className="flex items-center gap-1.5 bg-white/3 border border-white/8 rounded-xl px-3 py-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-mono text-slate-400">{mmSS(countdown)}</span>
                <button onClick={() => { fetchData(); setCountdown(300); }}
                  className="ml-1 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer" title="Refresh now">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </div>

              {/* Timeframes */}
              <div className="flex items-center gap-0.5 bg-white/3 border border-white/6 rounded-xl p-1">
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
                selectedStrategy={selectedStrategy}
                backtestTrades={activeTrades}
                timeframe={tf}
              />
            </div>
          </div>

          {/* ── Right panel ── */}
          <div className="w-[280px] flex-shrink-0 border-l border-white/5 flex flex-col bg-slate-900/40">
            {/* Tabs */}
            <div className="flex border-b border-white/5 flex-shrink-0">
              {([['signal', 'Signal'], ['strategy', 'Strategies']] as [Tab, string][]).map(([t, label]) => (
                <button key={t} onClick={() => setTab(t)}
                  className={`flex-1 py-3 text-sm font-medium cursor-pointer transition-all duration-150 border-b-2 ${
                    tab === t ? 'text-white border-emerald-500' : 'text-slate-500 border-transparent hover:text-slate-300'
                  }`}>
                  {label}
                  {t === 'strategy' && backtestResults && (
                    <span className="ml-1.5 px-1.5 py-0.5 rounded text-xs bg-amber-500/15 text-amber-400 border border-amber-500/20">
                      {backtestResults[selectedStrategy]?.winRate ?? 0}%
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Panel content */}
            <div className="flex-1 overflow-y-auto p-4">
              {tab === 'signal' ? (
                signal ? (
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
                )
              ) : (
                <StrategyPanel
                  results={backtestResults}
                  selectedStrategy={selectedStrategy}
                  onSelect={setSelectedStrategy}
                  signal={signal}
                  loading={backtestLoading || ohlcv.length < 40}
                  candles={ohlcv.length}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
