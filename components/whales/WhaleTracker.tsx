'use client';
import { useState, useEffect, useRef, useCallback } from 'react';

interface WhaleMove {
  id: string;
  symbol: string;
  type: 'buy' | 'sell';
  price: string;
  qty: string;
  usdValue: number;
  usdDisplay: string;
  timeAgo: string;
  time: Date;
  exchange: string;
  impact: number;
  alert: string | null;
}

interface VolStats { buyVol: number; sellVol: number; count: number }

// USD thresholds per base asset
const THRESHOLDS: Record<string, number> = {
  BTC: 500_000, ETH: 250_000, SOL: 100_000,
  XRP: 100_000, BNB: 100_000, ADA: 50_000,
};

function fmtUSD(v: number): string {
  if (v >= 1_000_000_000) return '$' + (v / 1_000_000_000).toFixed(2) + 'B';
  if (v >= 1_000_000)     return '$' + (v / 1_000_000).toFixed(1) + 'M';
  if (v >= 1_000)         return '$' + (v / 1_000).toFixed(0) + 'K';
  return '$' + v.toFixed(0);
}

function calcImpact(usd: number, sym: string): number {
  const max: Record<string, number> = { BTC: 50_000_000, ETH: 20_000_000, SOL: 5_000_000 };
  return Math.min(100, Math.round((usd / (max[sym] ?? 2_000_000)) * 100));
}

function makeAlert(usd: number, isSell: boolean): string | null {
  if (usd > 10_000_000) return isSell ? '🐋 Mega sell' : '🐋 Mega buy';
  if (usd >  5_000_000) return isSell ? 'Large dump'   : 'Large accum.';
  if (usd >  2_000_000) return isSell ? 'Exchange inflow' : 'Exchange outflow';
  return null;
}

function timeAgo(t: Date, now: Date): string {
  const d = Math.floor((now.getTime() - t.getTime()) / 1000);
  if (d < 60)   return 'just now';
  if (d < 3600) return Math.floor(d / 60) + 'm ago';
  return Math.floor(d / 3600) + 'h ago';
}

// ── Exchange configs ────────────────────────────────────────────────────────
interface ExchangeCfg {
  name: string;
  url: string;
  onOpen: (ws: WebSocket) => void;
  parse: (raw: string) => { symbol: string; price: number; qty: number; isSell: boolean; ts: number; id: string } | null;
}

const EXCHANGES: ExchangeCfg[] = [
  // ── Binance ──────────────────────────────────────────────────────────────
  {
    name: 'Binance',
    url: 'wss://stream.binance.com:9443/stream?streams=btcusdt@aggTrade/ethusdt@aggTrade/solusdt@aggTrade/xrpusdt@aggTrade/bnbusdt@aggTrade/adausdt@aggTrade',
    onOpen: () => {},
    parse: (raw) => {
      try {
        const { data: t } = JSON.parse(raw) as { data: { s: string; p: string; q: string; m: boolean; T: number; a: number } };
        return { symbol: t.s.replace('USDT',''), price: parseFloat(t.p), qty: parseFloat(t.q), isSell: t.m, ts: t.T, id: `bn-${t.a}` };
      } catch { return null; }
    },
  },

  // ── Bybit ────────────────────────────────────────────────────────────────
  {
    name: 'Bybit',
    url: 'wss://stream.bybit.com/v5/public/spot',
    onOpen: (ws) => {
      ws.send(JSON.stringify({ op: 'subscribe', args: ['publicTrade.BTCUSDT','publicTrade.ETHUSDT','publicTrade.SOLUSDT','publicTrade.XRPUSDT','publicTrade.ADAUSDT'] }));
    },
    parse: (raw) => {
      try {
        const msg = JSON.parse(raw);
        if (!msg.data || !Array.isArray(msg.data)) return null;
        const t = msg.data[0];
        if (!t) return null;
        const symbol = (msg.topic as string).replace('publicTrade.','').replace('USDT','');
        return { symbol, price: parseFloat(t.p), qty: parseFloat(t.v), isSell: t.S === 'Sell', ts: Number(t.T), id: `by-${t.i}` };
      } catch { return null; }
    },
  },

  // ── OKX ──────────────────────────────────────────────────────────────────
  {
    name: 'OKX',
    url: 'wss://ws.okx.com:8443/ws/v5/public',
    onOpen: (ws) => {
      ws.send(JSON.stringify({ op: 'subscribe', args: [
        { channel: 'trades', instId: 'BTC-USDT' },
        { channel: 'trades', instId: 'ETH-USDT' },
        { channel: 'trades', instId: 'SOL-USDT' },
        { channel: 'trades', instId: 'XRP-USDT' },
        { channel: 'trades', instId: 'ADA-USDT' },
      ]}));
    },
    parse: (raw) => {
      try {
        const msg = JSON.parse(raw);
        if (!msg.data || !Array.isArray(msg.data)) return null;
        const t = msg.data[0];
        if (!t || !t.instId) return null;
        const symbol = t.instId.replace('-USDT','');
        return { symbol, price: parseFloat(t.px), qty: parseFloat(t.sz), isSell: t.side === 'sell', ts: Number(t.ts), id: `okx-${t.tradeId}` };
      } catch { return null; }
    },
  },

  // ── Coinbase Advanced Trade ───────────────────────────────────────────────
  {
    name: 'Coinbase',
    url: 'wss://advanced-trade-ws.coinbase.com',
    onOpen: (ws) => {
      ws.send(JSON.stringify({ type: 'subscribe', product_ids: ['BTC-USD','ETH-USD','SOL-USD','XRP-USD'], channel: 'market_trades' }));
    },
    parse: (raw) => {
      try {
        const msg = JSON.parse(raw);
        if (msg.channel !== 'market_trades' || !msg.events) return null;
        for (const ev of msg.events) {
          if (!ev.trades?.length) continue;
          const t = ev.trades[0];
          const symbol = t.product_id.replace('-USD','');
          return { symbol, price: parseFloat(t.price), qty: parseFloat(t.size), isSell: t.side === 'SELL', ts: new Date(t.time).getTime(), id: `cb-${t.trade_id}` };
        }
        return null;
      } catch { return null; }
    },
  },

  // ── Kraken ───────────────────────────────────────────────────────────────
  {
    name: 'Kraken',
    url: 'wss://ws.kraken.com/v2',
    onOpen: (ws) => {
      ws.send(JSON.stringify({ method: 'subscribe', params: { channel: 'trade', symbol: ['BTC/USD','ETH/USD','SOL/USD','XRP/USD'] } }));
    },
    parse: (raw) => {
      try {
        const msg = JSON.parse(raw);
        if (msg.channel !== 'trade' || !msg.data?.length) return null;
        const t = msg.data[0];
        const symbol = msg.data[0]?.symbol?.split('/')[0] ?? t.symbol?.replace('/USD','');
        return { symbol, price: parseFloat(t.price), qty: parseFloat(t.qty), isSell: t.side === 'sell', ts: new Date(t.timestamp).getTime(), id: `kr-${t.trade_id}` };
      } catch { return null; }
    },
  },
];

const EXCHANGE_COLORS: Record<string, string> = {
  Binance:  'text-amber-400',
  Bybit:    'text-orange-400',
  OKX:      'text-blue-400',
  Coinbase: 'text-blue-300',
  Kraken:   'text-purple-400',
};

export default function WhaleTracker() {
  const [moves, setMoves]         = useState<WhaleMove[]>([]);
  const [volStats, setVolStats]   = useState<Record<string, VolStats>>({});
  const [connected, setConnected] = useState<Record<string, boolean>>({});
  const [totalVol, setTotalVol]   = useState(0);
  const [exFilter, setExFilter]   = useState<string>('all');
  const movesRef    = useRef<WhaleMove[]>([]);
  const wsRefs      = useRef<Map<string, WebSocket>>(new Map());
  const seenIds     = useRef<Set<string>>(new Set());

  const addTrade = useCallback((exchange: string, raw: Parameters<ExchangeCfg['parse']>[0]) => {
    const cfg = EXCHANGES.find(e => e.name === exchange);
    if (!cfg) return;
    const parsed = cfg.parse(raw);
    if (!parsed) return;
    const { symbol, price, qty, isSell, ts, id } = parsed;

    // De-duplicate (same trade can appear across feeds)
    if (seenIds.current.has(id)) return;
    seenIds.current.add(id);
    if (seenIds.current.size > 5000) {
      // Trim old ids
      const arr = [...seenIds.current];
      arr.splice(0, 1000);
      seenIds.current = new Set(arr);
    }

    const usdValue  = price * qty;
    const threshold = THRESHOLDS[symbol] ?? 500_000;
    if (usdValue < threshold) return;

    const now  = new Date();
    const move: WhaleMove = {
      id,
      symbol,
      type: isSell ? 'sell' : 'buy',
      price: price.toLocaleString('en-US', { maximumFractionDigits: 2 }),
      qty: qty.toFixed(4),
      usdValue,
      usdDisplay: fmtUSD(usdValue),
      time: new Date(ts),
      timeAgo: 'just now',
      exchange,
      impact: calcImpact(usdValue, symbol),
      alert: makeAlert(usdValue, isSell),
    };

    movesRef.current = [move, ...movesRef.current].slice(0, 50);
    setMoves([...movesRef.current]);
    setVolStats(prev => {
      const ex = prev[symbol] ?? { buyVol: 0, sellVol: 0, count: 0 };
      return { ...prev, [symbol]: {
        buyVol:  isSell ? ex.buyVol  : ex.buyVol  + usdValue,
        sellVol: isSell ? ex.sellVol + usdValue : ex.sellVol,
        count: ex.count + 1,
      }};
    });
    setTotalVol(v => v + usdValue);
  }, []);

  const connectExchange = useCallback((cfg: ExchangeCfg) => {
    if (typeof window === 'undefined') return;
    try {
      const ws = new WebSocket(cfg.url);
      wsRefs.current.set(cfg.name, ws);

      ws.onopen  = () => {
        cfg.onOpen(ws);
        setConnected(prev => ({ ...prev, [cfg.name]: true }));
      };
      ws.onclose = () => {
        setConnected(prev => ({ ...prev, [cfg.name]: false }));
        setTimeout(() => connectExchange(cfg), 5000);
      };
      ws.onerror = () => ws.close();
      ws.onmessage = (evt) => addTrade(cfg.name, evt.data);
    } catch { /* unavailable */ }
  }, [addTrade]);

  useEffect(() => {
    EXCHANGES.forEach(cfg => connectExchange(cfg));

    // Tick time-ago labels every 30s
    const id = setInterval(() => {
      const now = new Date();
      movesRef.current = movesRef.current.map(m => ({ ...m, timeAgo: timeAgo(m.time, now) }));
      setMoves([...movesRef.current]);
    }, 30_000);

    return () => {
      wsRefs.current.forEach(ws => ws.close());
      clearInterval(id);
    };
  }, [connectExchange]);

  const connectedCount = Object.values(connected).filter(Boolean).length;
  const exchanges = ['all', ...EXCHANGES.map(e => e.name)];

  const displayed = exFilter === 'all' ? moves : moves.filter(m => m.exchange === exFilter);

  return (
    <div className="bg-white/2 border border-white/8 rounded-2xl overflow-hidden flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${connectedCount > 0 ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
          <span className="text-sm font-semibold text-white">Whale Tracker</span>
          <span className="text-xs text-slate-500">{connectedCount}/{EXCHANGES.length} feeds · $500K+</span>
        </div>
        <div className="text-right">
          <div className="text-xs text-slate-500">Session vol</div>
          <div className="text-xs font-mono font-bold text-amber-400">{fmtUSD(totalVol)}</div>
        </div>
      </div>

      {/* Exchange status dots */}
      <div className="px-4 py-2 border-b border-white/5 flex items-center gap-3 flex-shrink-0 flex-wrap">
        {EXCHANGES.map(e => (
          <button
            key={e.name}
            onClick={() => setExFilter(f => f === e.name ? 'all' : e.name)}
            className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-xs transition-all border ${
              exFilter === e.name
                ? 'bg-white/10 border-white/15 text-white'
                : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${connected[e.name] ? 'bg-emerald-400 animate-pulse' : 'bg-red-500'}`} />
            <span className={EXCHANGE_COLORS[e.name]}>{e.name}</span>
          </button>
        ))}
        {exFilter !== 'all' && (
          <button onClick={() => setExFilter('all')} className="text-xs text-slate-600 hover:text-slate-400 ml-auto">Clear</button>
        )}
      </div>

      {/* Buy/sell pressure bars */}
      {Object.keys(volStats).length > 0 && (
        <div className="px-4 py-2 border-b border-white/5 flex-shrink-0 space-y-1.5">
          {Object.entries(volStats).map(([sym, st]) => {
            const total  = st.buyVol + st.sellVol;
            const buyPct = total > 0 ? Math.round((st.buyVol / total) * 100) : 50;
            const sentiment = buyPct > 60 ? 'Bullish' : buyPct < 40 ? 'Bearish' : 'Neutral';
            const sc = buyPct > 60 ? 'text-emerald-400' : buyPct < 40 ? 'text-red-400' : 'text-slate-400';
            return (
              <div key={sym}>
                <div className="flex justify-between text-xs mb-0.5">
                  <span className="font-mono font-medium text-slate-300">{sym}</span>
                  <span className={`font-medium ${sc}`}>{sentiment} · {st.count} trades</span>
                </div>
                <div className="flex h-1.5 rounded-full overflow-hidden">
                  <div className="bg-emerald-500" style={{ width: `${buyPct}%` }} />
                  <div className="bg-red-500"     style={{ width: `${100 - buyPct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Movement feed */}
      <div className="flex-1 overflow-y-auto max-h-72 divide-y divide-white/3">
        {displayed.length === 0 ? (
          <div className="py-10 text-center text-slate-500 text-xs">
            {connectedCount > 0 ? 'Watching for whale moves ($500K+) across exchanges…' : 'Connecting to exchanges…'}
          </div>
        ) : (
          displayed.map(m => (
            <div key={m.id} className={`px-4 py-2.5 hover:bg-white/2 transition-colors ${m.type === 'buy' ? 'border-l-2 border-emerald-500/40' : 'border-l-2 border-red-500/40'}`}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-mono text-xs font-bold text-white">{m.symbol}</span>
                  <span className={`px-1.5 py-0.5 rounded text-xs font-bold border ${m.type === 'buy' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25' : 'text-red-400 bg-red-500/10 border-red-500/25'}`}>
                    {m.type === 'buy' ? '▲ BUY' : '▼ SELL'}
                  </span>
                  <span className={`text-xs font-medium ${EXCHANGE_COLORS[m.exchange] ?? 'text-slate-400'}`}>{m.exchange}</span>
                  {m.alert && <span className="px-1.5 py-0.5 rounded text-xs bg-amber-500/15 text-amber-400 border border-amber-500/25">{m.alert}</span>}
                </div>
                <span className="text-xs font-mono font-bold text-white">{m.usdDisplay}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">{m.qty} {m.symbol} @ ${m.price}</span>
                <span className="text-xs text-slate-600">{m.timeAgo}</span>
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${m.type === 'buy' ? 'bg-emerald-500' : 'bg-red-500'}`} style={{ width: `${m.impact}%` }} />
                </div>
                <span className="text-xs text-slate-600 w-8 text-right">{m.impact}%</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
