'use client';
import { useState, useEffect, useRef, useCallback } from 'react';

interface WhaleMove {
  id: string;
  type: 'buy' | 'sell' | 'transfer';
  symbol: string;
  usd: number;
  usdDisplay: string;
  qty: string;
  exchange: string;
  wallet?: string;
  txHash?: string;
  time: Date;
  timeAgo: string;
  tag: 'mega' | 'whale' | 'large';
}

interface CoinStat {
  symbol: string;
  buy: number;
  sell: number;
  transfer: number;
  count: number;
  lastMove: 'buy' | 'sell' | 'transfer' | null;
  lastUsd: number;
}

function fmtUSD(v: number) {
  if (v >= 1e9) return '$' + (v / 1e9).toFixed(2) + 'B';
  if (v >= 1e6) return '$' + (v / 1e6).toFixed(2) + 'M';
  if (v >= 1e3) return '$' + (v / 1e3).toFixed(1) + 'K';
  return '$' + v.toFixed(0);
}

function getTag(usd: number): WhaleMove['tag'] {
  if (usd >= 10_000_000) return 'mega';
  if (usd >= 5_000_000)  return 'whale';
  return 'large';
}

function ago(t: Date, now: Date) {
  const d = Math.floor((now.getTime() - t.getTime()) / 1000);
  if (d < 10)  return 'now';
  if (d < 60)  return d + 's';
  if (d < 3600) return Math.floor(d / 60) + 'm';
  return Math.floor(d / 3600) + 'h';
}

function shortAddr(s: string) {
  return s ? s.slice(0, 6) + '…' + s.slice(-4) : '';
}

// All coins tracked across CEX exchanges
const ALL_SYMBOLS = ['BTC','ETH','SOL','XRP','BNB','ADA','DOGE','AVAX','DOT','MATIC','LINK','LTC','UNI','ATOM','TRX'];

const CEX_MIN_USD = 500_000; // $500K minimum for feed

interface ExCfg {
  name: string;
  url: string;
  onOpen: (ws: WebSocket) => void;
  parse: (raw: string) => { symbol: string; price: number; qty: number; isSell: boolean; ts: number; id: string } | null;
}

const EXCHANGES: ExCfg[] = [
  {
    name: 'Binance',
    url: `wss://stream.binance.com:9443/stream?streams=${ALL_SYMBOLS.map(s => s.toLowerCase() + 'usdt@aggTrade').join('/')}`,
    onOpen: () => {},
    parse: (raw) => {
      try {
        const { data: t } = JSON.parse(raw) as { data: { s: string; p: string; q: string; m: boolean; T: number; a: number } };
        if (!t?.s) return null;
        return { symbol: t.s.replace('USDT',''), price: parseFloat(t.p), qty: parseFloat(t.q), isSell: t.m, ts: t.T, id: `bn-${t.a}` };
      } catch { return null; }
    },
  },
  {
    name: 'Bybit',
    url: 'wss://stream.bybit.com/v5/public/spot',
    onOpen: (ws) => {
      ws.send(JSON.stringify({ op: 'subscribe', args: ['BTC','ETH','SOL','XRP','BNB','ADA','DOGE','AVAX','DOT','LINK'].map(s => `publicTrade.${s}USDT`) }));
    },
    parse: (raw) => {
      try {
        const msg = JSON.parse(raw);
        if (!msg.data || !Array.isArray(msg.data)) return null;
        const t = msg.data[0]; if (!t) return null;
        const symbol = (msg.topic as string).replace('publicTrade.','').replace('USDT','');
        return { symbol, price: parseFloat(t.p), qty: parseFloat(t.v), isSell: t.S === 'Sell', ts: Number(t.T), id: `by-${t.i}` };
      } catch { return null; }
    },
  },
  {
    name: 'OKX',
    url: 'wss://ws.okx.com:8443/ws/v5/public',
    onOpen: (ws) => {
      ws.send(JSON.stringify({ op: 'subscribe', args: ['BTC','ETH','SOL','XRP','ADA','DOT','LINK','DOGE','AVAX'].map(s => ({ channel: 'trades', instId: `${s}-USDT` })) }));
    },
    parse: (raw) => {
      try {
        const msg = JSON.parse(raw);
        if (!msg.data || !Array.isArray(msg.data)) return null;
        const t = msg.data[0]; if (!t?.instId) return null;
        return { symbol: t.instId.replace('-USDT',''), price: parseFloat(t.px), qty: parseFloat(t.sz), isSell: t.side === 'sell', ts: Number(t.ts), id: `okx-${t.tradeId}` };
      } catch { return null; }
    },
  },
  {
    name: 'Coinbase',
    url: 'wss://advanced-trade-ws.coinbase.com',
    onOpen: (ws) => {
      ws.send(JSON.stringify({ type: 'subscribe', product_ids: ['BTC-USD','ETH-USD','SOL-USD','XRP-USD','DOGE-USD','AVAX-USD','LTC-USD','LINK-USD'], channel: 'market_trades' }));
    },
    parse: (raw) => {
      try {
        const msg = JSON.parse(raw);
        if (msg.channel !== 'market_trades' || !msg.events) return null;
        for (const ev of msg.events) {
          if (!ev.trades?.length) continue;
          const t = ev.trades[0];
          return { symbol: t.product_id.replace('-USD',''), price: parseFloat(t.price), qty: parseFloat(t.size), isSell: t.side === 'SELL', ts: new Date(t.time).getTime(), id: `cb-${t.trade_id}` };
        }
        return null;
      } catch { return null; }
    },
  },
  {
    name: 'Kraken',
    url: 'wss://ws.kraken.com/v2',
    onOpen: (ws) => {
      ws.send(JSON.stringify({ method: 'subscribe', params: { channel: 'trade', symbol: ['BTC/USD','ETH/USD','SOL/USD','XRP/USD','ADA/USD','DOT/USD','LTC/USD'] } }));
    },
    parse: (raw) => {
      try {
        const msg = JSON.parse(raw);
        if (msg.channel !== 'trade' || !msg.data?.length) return null;
        const t = msg.data[0];
        const symbol = (t.symbol ?? '').split('/')[0]; if (!symbol) return null;
        return { symbol, price: parseFloat(t.price), qty: parseFloat(t.qty), isSell: t.side === 'sell', ts: new Date(t.timestamp).getTime(), id: `kr-${t.trade_id}` };
      } catch { return null; }
    },
  },
];

const EX_COLORS: Record<string, string> = {
  Binance: 'text-amber-400', Bybit: 'text-orange-400',
  OKX: 'text-blue-400', Coinbase: 'text-blue-300', Kraken: 'text-purple-400',
  'On-Chain BTC': 'text-orange-300',
};

let btcPriceRef = 100_000;

export default function WhaleTracker() {
  const [moves, setMoves]           = useState<WhaleMove[]>([]);
  const [coinStats, setCoinStats]   = useState<Record<string, CoinStat>>({});
  const [connected, setConnected]   = useState<Record<string, boolean>>({});
  const [sessionVol, setSessionVol] = useState(0);
  const [filter, setFilter]         = useState<'all' | 'cex' | 'onchain'>('all');
  const [flash, setFlash]           = useState<Record<string, 'buy' | 'sell' | null>>({});
  const movesRef  = useRef<WhaleMove[]>([]);
  const wsRefs    = useRef<Map<string, WebSocket>>(new Map());
  const seenIds   = useRef<Set<string>>(new Set());

  const push = useCallback((move: WhaleMove) => {
    if (seenIds.current.has(move.id)) return;
    seenIds.current.add(move.id);
    if (seenIds.current.size > 8000) {
      const arr = [...seenIds.current];
      seenIds.current = new Set(arr.slice(2000));
    }
    movesRef.current = [move, ...movesRef.current].slice(0, 100);
    setMoves([...movesRef.current]);
    setSessionVol(v => v + move.usd);

    // Update per-coin stats
    setCoinStats(prev => {
      const s = prev[move.symbol] ?? { symbol: move.symbol, buy: 0, sell: 0, transfer: 0, count: 0, lastMove: null, lastUsd: 0 };
      return {
        ...prev,
        [move.symbol]: {
          ...s,
          buy:      move.type === 'buy'      ? s.buy + move.usd      : s.buy,
          sell:     move.type === 'sell'     ? s.sell + move.usd     : s.sell,
          transfer: move.type === 'transfer' ? s.transfer + move.usd : s.transfer,
          count:    s.count + 1,
          lastMove: move.type,
          lastUsd:  move.usd,
        },
      };
    });

    // Flash animation on the coin card
    setFlash(prev => ({ ...prev, [move.symbol]: move.type === 'buy' ? 'buy' : move.type === 'sell' ? 'sell' : null }));
    setTimeout(() => setFlash(prev => ({ ...prev, [move.symbol]: null })), 800);
  }, []);

  const connectCEX = useCallback((cfg: ExCfg) => {
    if (typeof window === 'undefined') return;
    try {
      const ws = new WebSocket(cfg.url);
      wsRefs.current.set(cfg.name, ws);
      ws.onopen  = () => { cfg.onOpen(ws); setConnected(p => ({ ...p, [cfg.name]: true })); };
      ws.onclose = () => { setConnected(p => ({ ...p, [cfg.name]: false })); setTimeout(() => connectCEX(cfg), 5000); };
      ws.onerror = () => ws.close();
      ws.onmessage = (evt) => {
        const parsed = cfg.parse(evt.data);
        if (!parsed) return;
        const { symbol, price, qty, isSell, ts, id } = parsed;
        if (!symbol || price <= 0 || qty <= 0) return;
        const usd = price * qty;

        // Always update coin stats for the volume chart (no minimum)
        if (usd >= 50_000) {
          setCoinStats(prev => {
            const s = prev[symbol] ?? { symbol, buy: 0, sell: 0, transfer: 0, count: 0, lastMove: null, lastUsd: 0 };
            return {
              ...prev,
              [symbol]: {
                ...s,
                buy:  isSell ? s.buy  : s.buy  + usd,
                sell: isSell ? s.sell + usd : s.sell,
                count: s.count + 1,
                lastMove: isSell ? 'sell' : 'buy',
                lastUsd: usd,
              },
            };
          });
          if (symbol === 'BTC') btcPriceRef = price;
        }

        // Only add to whale feed if above threshold
        if (usd < CEX_MIN_USD) return;
        if (seenIds.current.has(id)) return;

        push({
          id, type: isSell ? 'sell' : 'buy', symbol, usd,
          usdDisplay: fmtUSD(usd),
          qty: qty.toFixed(symbol === 'BTC' ? 4 : 2) + ' ' + symbol,
          exchange: cfg.name,
          time: new Date(ts || Date.now()),
          timeAgo: 'now',
          tag: getTag(usd),
        });
      };
    } catch {}
  }, [push]);

  const connectBTCOnChain = useCallback(() => {
    if (typeof window === 'undefined') return;
    try {
      const ws = new WebSocket('wss://ws.blockchain.info/inv');
      wsRefs.current.set('btc-onchain', ws);
      ws.onopen = () => { ws.send(JSON.stringify({ op: 'unconfirmed_sub' })); setConnected(p => ({ ...p, 'On-Chain BTC': true })); };
      ws.onclose = () => { setConnected(p => ({ ...p, 'On-Chain BTC': false })); setTimeout(() => connectBTCOnChain(), 8000); };
      ws.onerror = () => ws.close();
      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          if (msg.op !== 'utx' || !msg.x) return;
          const totalSats: number = (msg.x.out ?? []).reduce((s: number, o: { value: number }) => s + (o.value ?? 0), 0);
          const btc = totalSats / 1e8;
          if (btc < 5) return;
          const usd = btc * btcPriceRef;
          if (usd < 500_000) return;
          push({
            id: `btc-${msg.x.hash}`, type: 'transfer', symbol: 'BTC', usd,
            usdDisplay: fmtUSD(usd), qty: btc.toFixed(4) + ' BTC',
            exchange: 'On-Chain BTC', wallet: shortAddr(msg.x.hash ?? ''), txHash: msg.x.hash,
            time: new Date((msg.x.time ?? Math.floor(Date.now() / 1000)) * 1000),
            timeAgo: 'now', tag: getTag(usd),
          });
        } catch {}
      };
    } catch {}
  }, [push]);

  useEffect(() => {
    EXCHANGES.forEach(cfg => connectCEX(cfg));
    connectBTCOnChain();
    const tick = setInterval(() => {
      const now = new Date();
      movesRef.current = movesRef.current.map(m => ({ ...m, timeAgo: ago(m.time, now) }));
      setMoves([...movesRef.current]);
    }, 10_000);
    return () => {
      wsRefs.current.forEach(ws => { try { ws.close(); } catch {} });
      clearInterval(tick);
    };
  }, [connectCEX, connectBTCOnChain]);

  const connCEX = EXCHANGES.filter(e => connected[e.name]).length;

  // Build ordered coin list: tracked symbols + any others that appeared
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

  return (
    <div className="bg-white/2 border border-white/8 rounded-2xl overflow-hidden flex flex-col">

      {/* ── Header ── */}
      <div className="px-4 py-3 border-b border-white/5 flex-shrink-0">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${connCEX > 0 ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
            <span className="text-sm font-semibold text-white">Crypto Whale Tracker</span>
          </div>
          <div className="flex items-center gap-3 text-[10px]">
            <span className="text-slate-500">Session: <span className="text-amber-400 font-mono font-bold">{fmtUSD(sessionVol)}</span></span>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap text-[10px] text-slate-500">
          {EXCHANGES.map(e => (
            <span key={e.name} className="flex items-center gap-1">
              <span className={`w-1.5 h-1.5 rounded-full ${connected[e.name] ? 'bg-emerald-400' : 'bg-slate-700'}`} />
              <span className={EX_COLORS[e.name]}>{e.name}</span>
            </span>
          ))}
          <span className="flex items-center gap-1">
            <span className={`w-1.5 h-1.5 rounded-full ${connected['On-Chain BTC'] ? 'bg-orange-400' : 'bg-slate-700'}`} />
            <span className="text-orange-300/70">On-Chain</span>
          </span>
        </div>
      </div>

      {/* ── Coin grid — all coins side by side ── */}
      <div className="px-3 py-3 border-b border-white/5 flex-shrink-0">
        <div className="text-[10px] text-slate-600 uppercase tracking-wider mb-2">Live Buy / Sell Pressure — All Coins</div>
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
                {/* Symbol + sentiment dot */}
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-mono text-xs font-bold text-white">{sym}</span>
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    !s ? 'bg-slate-700' :
                    sentiment === 'bull' ? 'bg-emerald-400' :
                    sentiment === 'bear' ? 'bg-red-400' : 'bg-slate-500'
                  }`} />
                </div>

                {/* Buy/sell bar */}
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

                {/* Percentages */}
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

                {/* Volume */}
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
            {f === 'all' ? `All (${moves.length})` : f === 'cex' ? '📊 Exchange' : '⛓️ On-Chain'}
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
                  }`}>{m.tag === 'mega' ? '🐳 MEGA' : '🐋 WHALE'}</span>
                )}
                <span className={`text-[10px] ${EX_COLORS[m.exchange] ?? 'text-slate-500'}`}>{m.exchange}</span>
                <span className="text-[10px] text-slate-600 ml-auto">{m.timeAgo}</span>
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
