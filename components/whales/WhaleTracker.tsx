'use client';
import { useState, useEffect } from 'react';
import { useWhaleStore } from '@/store/useWhaleStore';
import { WHALE_EXCHANGES } from './WhaleCollector';

function fmtUSD(v: number) {
  if (v >= 1e9) return '$' + (v / 1e9).toFixed(2) + 'B';
  if (v >= 1e6) return '$' + (v / 1e6).toFixed(2) + 'M';
  if (v >= 1e3) return '$' + (v / 1e3).toFixed(1) + 'K';
  return '$' + v.toFixed(0);
}

function ago(ts: number, now: number) {
  const d = Math.floor((now - ts) / 1000);
  if (d < 10)  return 'now';
  if (d < 60)  return d + 's';
  if (d < 3600) return Math.floor(d / 60) + 'm';
  if (d < 86400) return Math.floor(d / 3600) + 'h';
  return Math.floor(d / 86400) + 'd';
}

const ALL_SYMBOLS = ['BTC','ETH','SOL','XRP','BNB','ADA','DOGE','AVAX','DOT','MATIC','LINK','LTC','UNI','ATOM','TRX'];

const EX_COLORS: Record<string, string> = {
  Binance: 'text-amber-400', Bybit: 'text-orange-400',
  OKX: 'text-blue-400', Coinbase: 'text-blue-300', Kraken: 'text-purple-400',
  'On-Chain BTC': 'text-orange-300',
};

export default function WhaleTracker() {
  const { moves, coinStats, totalVol, startedAt, connected, flash, resetStats } = useWhaleStore();
  const [filter, setFilter] = useState<'all' | 'cex' | 'onchain'>('all');
  const [now, setNow] = useState(Date.now());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
    const id = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(id);
  }, []);

  const connCEX = WHALE_EXCHANGES.filter(e => connected[e]).length;

  const orderedSymbols = [
    ...ALL_SYMBOLS,
    ...Object.keys(coinStats).filter(s => !ALL_SYMBOLS.includes(s)),
  ];

  const displayed = (filter === 'onchain' ? moves.filter(m => m.exchange === 'On-Chain BTC') :
                     filter === 'cex'     ? moves.filter(m => m.exchange !== 'On-Chain BTC') :
                     moves);

  const buyVol  = moves.filter(m => m.type === 'buy').reduce((s, m) => s + m.usd, 0);
  const sellVol = moves.filter(m => m.type === 'sell').reduce((s, m) => s + m.usd, 0);
  const totalPressure = buyVol + sellVol;
  const buyPct = totalPressure > 0 ? Math.round((buyVol / totalPressure) * 100) : 50;

  // ── Heat map data: net whale flow per coin (buy − sell), intensity by |net| ──
  const heatData = orderedSymbols.map(sym => {
    const s = coinStats[sym];
    const net = s ? s.buy - s.sell : 0;
    const vol = s ? s.buy + s.sell + s.transfer : 0;
    return { sym, net, vol };
  });
  const maxAbsNet = Math.max(1, ...heatData.map(h => Math.abs(h.net)));
  const maxVol = Math.max(1, ...heatData.map(h => h.vol));

  if (!hydrated) {
    return (
      <div className="bg-white/2 border border-white/8 rounded-2xl p-8 text-center text-slate-600 text-xs">
        Loading whale data…
      </div>
    );
  }

  const trackedSince = ago(startedAt, now);

  return (
    <div className="bg-white/2 border border-white/8 rounded-2xl overflow-hidden flex flex-col">

      {/* ── Header ── */}
      <div className="px-4 py-3 border-b border-white/5 flex-shrink-0">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${connCEX > 0 ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
            <span className="text-sm font-semibold text-white">Crypto Whale Tracker</span>
          </div>
          <div className="flex items-center gap-2 text-[10px]">
            <span className="text-slate-500">Tracked: <span className="text-amber-400 font-mono font-bold">{fmtUSD(totalVol)}</span> · {trackedSince}</span>
            <button onClick={() => { if (confirm('Reset accumulated whale data?')) resetStats(); }}
              title="Reset accumulated data"
              className="text-slate-600 hover:text-red-400 transition-colors cursor-pointer p-0.5">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap text-[10px] text-slate-500">
          {WHALE_EXCHANGES.map(name => (
            <span key={name} className="flex items-center gap-1">
              <span className={`w-1.5 h-1.5 rounded-full ${connected[name] ? 'bg-emerald-400' : 'bg-slate-700'}`} />
              <span className={EX_COLORS[name]}>{name}</span>
            </span>
          ))}
          <span className="flex items-center gap-1">
            <span className={`w-1.5 h-1.5 rounded-full ${connected['On-Chain BTC'] ? 'bg-orange-400' : 'bg-slate-700'}`} />
            <span className="text-orange-300/70">On-Chain</span>
          </span>
        </div>
      </div>

      {/* ── HEAT MAP — where the whale money is flowing ── */}
      <div className="px-3 py-3 border-b border-white/5 flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] text-slate-600 uppercase tracking-wider">Whale Flow Heat Map</span>
          <span className="text-[9px] text-slate-600">
            <span className="text-emerald-400">green</span> = net buying · <span className="text-red-400">red</span> = net selling · brightness = intensity
          </span>
        </div>
        <div className="grid grid-cols-5 gap-1">
          {heatData.map(({ sym, net, vol }) => {
            const intensity = Math.abs(net) / maxAbsNet;       // 0..1 color strength
            const alpha = vol > 0 ? 0.12 + intensity * 0.55 : 0.03;
            const isBuy = net > 0;
            const f = flash[sym];
            return (
              <div key={sym}
                title={`${sym}: net ${isBuy ? '+' : ''}${fmtUSD(Math.abs(net))} ${isBuy ? 'buying' : 'selling'} · total ${fmtUSD(vol)}`}
                className={`rounded-lg p-1.5 text-center transition-all duration-500 border cursor-default ${
                  f ? (f === 'buy' ? 'border-emerald-400/70 scale-105' : 'border-red-400/70 scale-105') : 'border-white/5'
                }`}
                style={{
                  backgroundColor: vol === 0
                    ? 'rgba(255,255,255,0.02)'
                    : isBuy
                      ? `rgba(16,185,129,${alpha})`
                      : `rgba(239,68,68,${alpha})`,
                }}>
                <div className="font-mono text-[10px] font-bold text-white">{sym}</div>
                <div className={`font-mono text-[9px] ${vol === 0 ? 'text-slate-700' : isBuy ? 'text-emerald-300' : 'text-red-300'}`}>
                  {vol === 0 ? '—' : `${isBuy ? '+' : '−'}${fmtUSD(Math.abs(net))}`}
                </div>
                {/* volume mini-bar */}
                <div className="h-0.5 mt-1 rounded-full bg-white/5 overflow-hidden">
                  <div className={`h-full ${isBuy ? 'bg-emerald-400/70' : 'bg-red-400/70'}`}
                    style={{ width: `${(vol / maxVol) * 100}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Coin grid — buy/sell pressure detail ── */}
      <div className="px-3 py-3 border-b border-white/5 flex-shrink-0">
        <div className="text-[10px] text-slate-600 uppercase tracking-wider mb-2">Buy / Sell Pressure — Accumulated</div>
        <div className="grid grid-cols-3 gap-1.5">
          {orderedSymbols.map(sym => {
            const s = coinStats[sym];
            const total = s ? s.buy + s.sell + s.transfer : 0;
            const bPct  = total > 0 ? (s!.buy  / total) * 100 : 50;
            const sPct  = total > 0 ? (s!.sell / total) * 100 : 50;
            const sentiment = bPct > 55 ? 'bull' : bPct < 45 ? 'bear' : 'neutral';
            const f = flash[sym];
            return (
              <div key={sym} className={`rounded-lg border p-2 transition-all duration-300 ${
                f === 'buy'  ? 'bg-emerald-500/20 border-emerald-500/50' :
                f === 'sell' ? 'bg-red-500/20 border-red-500/50' :
                sentiment === 'bull' ? 'bg-emerald-500/5 border-emerald-500/20' :
                sentiment === 'bear' ? 'bg-red-500/5 border-red-500/20' :
                'bg-white/3 border-white/8'
              }`}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-mono text-xs font-bold text-white">{sym}</span>
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    !s ? 'bg-slate-700' :
                    sentiment === 'bull' ? 'bg-emerald-400' :
                    sentiment === 'bear' ? 'bg-red-400' : 'bg-slate-500'
                  }`} />
                </div>
                <div className="h-1.5 rounded-full overflow-hidden bg-white/5 mb-1">
                  {s && total > 0 ? (
                    <div className="h-full flex">
                      <div className="bg-emerald-500 transition-all duration-500" style={{ width: `${bPct}%` }} />
                      <div className="bg-red-500 transition-all duration-500"     style={{ width: `${sPct}%` }} />
                    </div>
                  ) : (
                    <div className="h-full w-1/2 bg-slate-700 rounded-full" />
                  )}
                </div>
                <div className="flex justify-between text-[9px]">
                  <span className={sentiment === 'bull' ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                    {s ? Math.round(bPct) : 50}%
                  </span>
                  <span className={s ? (sentiment === 'bull' ? 'text-emerald-400' : sentiment === 'bear' ? 'text-red-400' : 'text-slate-500') : 'text-slate-600'}>
                    {!s ? '—' : sentiment === 'bull' ? '↑ BUY' : sentiment === 'bear' ? '↓ SELL' : '→'}
                  </span>
                  <span className={sentiment === 'bear' ? 'text-red-400 font-bold' : 'text-slate-500'}>
                    {s ? Math.round(sPct) : 50}%
                  </span>
                </div>
                {s && total > 0 && (
                  <div className="text-[9px] text-slate-600 text-center mt-0.5">{fmtUSD(total)}</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Overall pressure bar ── */}
      {totalPressure > 0 && (
        <div className="px-4 py-2 border-b border-white/5 flex-shrink-0">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-emerald-400 font-mono font-bold">{buyPct}% BUY {fmtUSD(buyVol)}</span>
            <span className={buyPct > 55 ? 'text-emerald-400' : buyPct < 45 ? 'text-red-400' : 'text-slate-400'}>
              {buyPct > 55 ? '↑ Bullish' : buyPct < 45 ? '↓ Bearish' : '→ Balanced'}
            </span>
            <span className="text-red-400 font-mono font-bold">{fmtUSD(sellVol)} SELL {100 - buyPct}%</span>
          </div>
          <div className="flex h-2 rounded-full overflow-hidden">
            <div className="bg-emerald-500 transition-all duration-1000" style={{ width: `${buyPct}%` }} />
            <div className="bg-red-500 transition-all duration-1000"     style={{ width: `${100 - buyPct}%` }} />
          </div>
        </div>
      )}

      {/* ── Filter tabs ── */}
      <div className="px-4 py-2 border-b border-white/5 flex gap-1 flex-shrink-0">
        {(['all','cex','onchain'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-2.5 py-1 rounded-lg text-xs border transition-all cursor-pointer ${filter === f ? 'bg-white/10 border-white/15 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
            {f === 'all' ? `All (${moves.length})` : f === 'cex' ? 'Exchange' : 'On-Chain'}
          </button>
        ))}
      </div>

      {/* ── Whale feed ── */}
      <div className="flex-1 overflow-y-auto max-h-72 divide-y divide-white/3">
        {displayed.length === 0 ? (
          <div className="py-8 text-center text-slate-600 text-xs">
            {connCEX > 0 ? 'Watching $500K+ moves across all coins & exchanges…' : 'Connecting…'}
          </div>
        ) : displayed.map(m => (
          <div key={m.id} className={`px-3 py-2 hover:bg-white/2 transition-colors flex items-start gap-2 ${
            m.tag === 'mega'  ? 'border-l-2 border-yellow-400/60 bg-yellow-500/5' :
            m.tag === 'whale' ? 'border-l-2 border-purple-400/50 bg-purple-500/5' :
            m.type === 'buy'  ? 'border-l-2 border-emerald-500/30' :
            m.type === 'sell' ? 'border-l-2 border-red-500/30' :
            'border-l-2 border-orange-500/30'
          }`}>
            <span className={`text-sm font-bold flex-shrink-0 mt-0.5 ${m.type === 'buy' ? 'text-emerald-400' : m.type === 'sell' ? 'text-red-400' : 'text-orange-300'}`}>
              {m.type === 'buy' ? '▲' : m.type === 'sell' ? '▼' : '⇄'}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-mono text-xs font-bold text-white">{m.symbol}</span>
                <span className={`font-mono text-sm font-bold ${
                  m.tag === 'mega' ? 'text-yellow-300' : m.tag === 'whale' ? 'text-purple-300' : 'text-blue-300'
                }`}>{m.usdDisplay}</span>
                {m.tag !== 'large' && (
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                    m.tag === 'mega' ? 'text-yellow-300 bg-yellow-500/15 border-yellow-500/40' : 'text-purple-300 bg-purple-500/15 border-purple-500/40'
                  }`}>{m.tag === 'mega' ? 'MEGA' : 'WHALE'}</span>
                )}
                <span className={`text-[10px] ${EX_COLORS[m.exchange] ?? 'text-slate-500'}`}>{m.exchange}</span>
                <span className="text-[10px] text-slate-600 ml-auto">{ago(m.time, now)}</span>
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1">
                <span>{m.qty}</span>
                {m.wallet && (
                  <>
                    <span>·</span>
                    <a href={`https://www.blockchain.com/btc/tx/${m.txHash}`} target="_blank" rel="noopener noreferrer"
                       className="font-mono text-orange-300/60 hover:text-orange-300 transition-colors">
                      {m.wallet}
                    </a>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
