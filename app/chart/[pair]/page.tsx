'use client';
import { useEffect, useState } from 'react';
import { use } from 'react';
import dynamic from 'next/dynamic';
import Sidebar from '@/components/layout/Sidebar';
import TopBar from '@/components/layout/TopBar';
import SignalOverlay from '@/components/chart/SignalOverlay';
import { getPairById } from '@/lib/pairConfig';
import { calculateSignal, type SignalResult } from '@/lib/signalEngine';
import { calculateLevels, type TradeLevels } from '@/lib/levelCalculator';
import { getBestStrategy, type Strategy } from '@/lib/strategyMatcher';

const LiveChart = dynamic(() => import('@/components/chart/LiveChart'), { ssr: false });

const TFS = ['5m', '15m', '1h', '4h', '1D'] as const;
type TF = typeof TFS[number];

export default function ChartPage({ params }: { params: Promise<{ pair: string }> }) {
  const { pair: pairId } = use(params);
  const pair = getPairById(pairId);

  const [tf, setTf] = useState<TF>('1h');
  const [tradeType, setTradeType] = useState<'spot' | 'long' | 'short'>('spot');
  const [signal, setSignal] = useState<SignalResult | null>(null);
  const [levels, setLevels] = useState<TradeLevels | null>(null);
  const [strategy, setStrategy] = useState<Strategy | null>(null);
  const [showEMA, setShowEMA] = useState(true);
  const [showBB, setShowBB] = useState(false);

  useEffect(() => {
    if (!pair) return;
    fetch(`/api/ohlcv/${pairId}?tf=${tf}`)
      .then(r => r.json())
      .then(ohlcv => {
        if (!Array.isArray(ohlcv) || ohlcv.length < 30) return;
        const sig = calculateSignal(ohlcv);
        const lvl = calculateLevels(ohlcv, sig.signal, pair);
        const { best } = getBestStrategy(sig);
        setSignal(sig);
        setLevels(lvl);
        setStrategy(best);
      })
      .catch(() => {});
  }, [pairId, tf, pair]);

  if (!pair) return (
    <div className="flex h-screen items-center justify-center bg-[#020617] text-slate-400">Pair not found</div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-[#020617]">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar />
        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 flex flex-col p-4 overflow-hidden">
            <div className="flex items-center justify-between mb-3 flex-shrink-0">
              <h1 className="font-bold text-xl text-white font-mono">{pair.name}</h1>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  {[{label:'EMA',active:showEMA,toggle:()=>setShowEMA(v=>!v)},{label:'BB',active:showBB,toggle:()=>setShowBB(v=>!v)}].map(o => (
                    <button key={o.label} onClick={o.toggle}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all duration-150 border ${o.active ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-white/5 text-slate-500 border-white/8 hover:bg-white/8'}`}>
                      {o.label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-1">
                  {TFS.map(t => (
                    <button key={t} onClick={() => setTf(t)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium cursor-pointer transition-all duration-150 ${tf === t ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5 border border-transparent'}`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex-1 bg-white/2 border border-white/8 rounded-2xl overflow-hidden">
              <LiveChart pairId={pairId} levels={levels} signal={signal} showEMA={showEMA} showBB={showBB} timeframe={tf} />
            </div>
          </div>

          <div className="w-72 flex-shrink-0 border-l border-white/5 overflow-y-auto p-4 bg-slate-900/40">
            {signal ? (
              <SignalOverlay signal={signal} levels={levels} strategy={strategy} tradeType={tradeType} onTradeTypeChange={setTradeType} />
            ) : (
              <div className="flex items-center justify-center h-48 text-slate-500">
                <div className="text-center">
                  <div className="w-6 h-6 border-2 border-slate-500 border-t-emerald-400 rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-sm">Loading signal...</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
