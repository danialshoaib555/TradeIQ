'use client';
import { useState, useEffect, useRef, useCallback } from 'react';

interface Trade {
  id: string;
  symbol: string;
  type: 'buy' | 'sell';
  price: number;
  qty: number;
  usd: number;
  usdDisplay: string;
  exchange: string;
  time: Date;
  timeAgo: string;
  tag: 'mega' | 'whale' | 'large' | 'normal';
}

interface SymbolStats { buy: number; sell: number; trades: number }

function fmtUSD(v: number) {
  if (v >= 1e9) return '$' + (v / 1e9).toFixed(2) + 'B';
  if (v >= 1e6) return '$' + (v / 1e6).toFixed(2) + 'M';
  if (v >= 1e3) return '$' + (v / 1e3).toFixed(0) + 'K';
  return '$' + v.toFixed(0);
}

function getTag(usd: number): Trade['tag'] {
  if (usd >= 10_000_000) return 'mega';
  if (usd >= 1_000_000)  return 'whale';
  if (usd >= 100_000)    return 'large';
  return 'normal';
}

function tagStyle(tag: Trade['tag']) {
  if (tag === 'mega')  return 'text-yellow-300 bg-yellow-500/20 border-yellow-500/40';
  if (tag === 'whale') return 'text-purple-300 bg-purple-500/20 border-purple-500/40';
  if (tag === 'large') return 'text-blue-300 bg-blue-500/20 border-blue-500/30';
  return '';
}

function tagLabel(tag: Trade['tag']) {
  if (tag === 'mega')  return '🐳 MEGA';
  if (tag === 'whale') return '🐋 WHALE';
  if (tag === 'large') return '🦈 LARGE';
  return null;
}

function ago(t: Date, now: Date) {
  const d = Math.floor((now.getTime() - t.getTime()) / 1000);
  if (d < 5)   return 'now';
  if (d < 60)  return d + 's ago';
  if (d < 3600) return Math.floor(d / 60) + 'm ago';
  return Math.floor(d / 3600) + 'h ago';
}

// ── All symbols we track across exchanges ───────────────────────────────────
const SYMBOLS = ['BTC','ETH','SOL','XRP','BNB','ADA','DOGE','AVAX','DOT','MATIC','LINK','UNI','ATOM','LTC','TRX','SHIB','TON','NEAR','APT','ARB'];

const EXCHANGE_COLORS: Record<string, string> = {
  Binance: 'text-amber-400', Bybit: 'text-orange-400',
  OKX: 'text-blue-400', Coinbase: 'text-blue-300', Kraken: 'text-purple-400',
};

// ── Exchange WebSocket configs ───────────────────────────────────────────────
interface ExCfg {
  name: string;
  url: string;
  onOpen: (ws: WebSocket) => void;
  parse: (raw: string) => { symbol: string; price: number; qty: number; isSell: boolean; ts: number; id: string } | null;
}

const EXCHANGES: ExCfg[] = [
  {
    name: 'Binance',
    url: `wss://stream.binance.com:9443/stream?streams=${SYMBOLS.map(s => s.toLowerCase() + 'usdt@aggTrade').join('/')}`,
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
      const args = ['BTC','ETH','SOL','XRP','BNB','ADA','DOGE','AVAX','DOT'].map(s => `publicTrade.${s}USDT`);
      ws.send(JSON.stringify({ op: 'subscribe', args }));
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
  {
    name: 'OKX',
    url: 'wss://ws.okx.com:8443/ws/v5/public',
    onOpen: (ws) => {
      const args = ['BTC','ETH','SOL','XRP','ADA','DOGE','DOT','AVAX','LINK','ATOM'].map(s => ({ channel: 'trades', instId: `${s}-USDT` }));
      ws.send(JSON.stringify({ op: 'subscribe', args }));
    },
    parse: (raw) => {
      try {
        const msg = JSON.parse(raw);
        if (!msg.data || !Array.isArray(msg.data)) return null;
        const t = msg.data[0];
        if (!t?.instId) return null;
        const symbol = t.instId.replace('-USDT','');
        return { symbol, price: parseFloat(t.px), qty: parseFloat(t.sz), isSell: t.side === 'sell', ts: Number(t.ts), id: `okx-${t.tradeId}` };
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
          const symbol = t.product_id.replace('-USD','');
          return { symbol, price: parseFloat(t.price), qty: parseFloat(t.size), isSell: t.side === 'SELL', ts: new Date(t.time).getTime(), id: `cb-${t.trade_id}` };
        }
        return null;
      } catch { return null; }
    },
  },
  {
    name: 'Kraken',
    url: 'wss://ws.kraken.com/v2',
    onOpen: (ws) => {
      ws.send(JSON.stringify({ method: 'subscribe', params: { channel: 'trade', symbol: ['BTC/USD','ETH/USD','SOL/USD','XRP/USD','ADA/USD','DOT/USD'] } }));
    },
    parse: (raw) => {
      try {
        const msg = JSON.parse(raw);
        if (msg.channel !== 'trade' || !msg.data?.length) return null;
        const t = msg.data[0];
        const symbol = (t.symbol ?? '').split('/')[0];
        if (!symbol) return null;
        return { symbol, price: parseFloat(t.price), qty: parseFloat(t.qty), isSell: t.side === 'sell', ts: new Date(t.timestamp).getTime(), id: `kr-${t.trade_id}` };
      } catch { return null; }
    },
  },
];

// Minimum USD value to show in feed
const MIN_USD = 10_000;

export default function WhaleTracker() {
  const [trades, setTrades]         = useState<Trade[]>([]);
  const [stats, setStats]           = useState<Record<string, SymbolStats>>({});
  const [connected, setConnected]   = useState<Record<string, boolean>>({});
  const [sessionVol, setSessionVol] = useState(0);
  const [filter, setFilter]         = useState<'all' | 'large' | 'whale'>('all');
  const [symFilter, setSymFilter]   = useState<string>('ALL');
  const tradesRef = useRef<Trade[]>([]);
  const wsRefs    = useRef<Map<string, WebSocket>>(new Map());
  const seenIds   = useRef<Set<string>>(new Set());

  const addTrade = useCallback((exchange: string, raw: string) => {
    const cfg = EXCHANGES.find(e => e.name === exchange);
    if (!cfg) return;
    const parsed = cfg.parse(raw);
    if (!parsed) return;
    const { symbol, price, qty, isSell, ts, id } = parsed;
    if (!symbol || price <= 0 || qty <= 0) return;
    if (seenIds.current.has(id)) return;
    seenIds.current.add(id);
    if (seenIds.current.size > 10000) {
      const arr = [...seenIds.current];
      seenIds.current = new Set(arr.slice(2000));
    }

    const usd = price * qty;
    if (usd < MIN_USD) return;

    const now = new Date();
    const trade: Trade = {
      id, symbol, type: isSell ? 'sell' : 'buy',
      price, qty, usd,
      usdDisplay: fmtUSD(usd),
      exchange,
      time: new Date(ts || now),
      timeAgo: 'now',
      tag: getTag(usd),
    };

    tradesRef.current = [trade, ...tradesRef.current].slice(0, 100);
    setTrades([...tradesRef.current]);
    setStats(prev => {
      const s = prev[symbol] ?? { buy: 0, sell: 0, trades: 0 };
      return { ...prev, [symbol]: { buy: isSell ? s.buy : s.buy + usd, sell: isSell ? s.sell + usd : s.sell, trades: s.trades + 1 } };
    });
    setSessionVol(v => v + usd);
  }, []);

  const connect = useCallback((cfg: ExCfg) => {
    if (typeof window === 'undefined') return;
    try {
      const ws = new WebSocket(cfg.url);
      wsRefs.current.set(cfg.name, ws);
      ws.onopen  = () => { cfg.onOpen(ws); setConnected(p => ({ ...p, [cfg.name]: true })); };
      ws.onclose = () => { setConnected(p => ({ ...p, [cfg.name]: false })); setTimeout(() => connect(cfg), 5000); };
      ws.onerror = () => ws.close();
      ws.onmessage = (evt) => addTrade(cfg.name, evt.data);
    } catch {}
  }, [addTrade]);

  useEffect(() => {
    EXCHANGES.forEach(cfg => connect(cfg));
    const tick = setInterval(() => {
      const now = new Date();
      tradesRef.current = tradesRef.current.map(t => ({ ...t, timeAgo: ago(t.time, now) }));
      setTrades([...tradesRef.current]);
    }, 5000);
    return () => {
      wsRefs.current.forEach(ws => ws.close());
      clearInterval(tick);
    };
  }, [connect]);

  const connCount = Object.values(connected).filter(Boolean).length;

  const topSymbols = Object.entries(stats)
    .sort((a, b) => (b[1].buy + b[1].sell) - (a[1].buy + a[1].sell))
    .slice(0, 8)
    .map(([s]) => s);

  let displayed = tradesRef.current;
  if (filter === 'large') displayed = displayed.filter(t => t.usd >= 100_000);
  if (filter === 'whale') displayed = displayed.filter(t => t.usd >= 1_000_000);
  if (symFilter !== 'ALL') displayed = displayed.filter(t => t.symbol === symFilter);
  displayed = displayed.slice(0, 60);

  const buyVol  = displayed.reduce((s, t) => t.type === 'buy'  ? s + t.usd : s, 0);
  const sellVol = displayed.reduce((s, t) => t.type === 'sell' ? s + t.usd : s, 0);
  const totalVol = buyVol + sellVol;
  const buyPct = totalVol > 0 ? Math.round((buyVol / totalVol) * 100) : 50;

  return (
    <div className="bg-white/2 border border-white/8 rounded-2xl overflow-hidden flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/5 flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${connCount > 0 ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
            <span className="text-sm font-semibold text-white">Crypto Network Activity</span>
            <span className="text-xs text-slate-500">{connCount}/{EXCHANGES.length} feeds</span>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-slate-600">Session vol</div>
            <div className="text-xs font-mono font-bold text-amber-400">{fmtUSD(sessionVol)}</div>
          </div>
        </div>

        {/* Exchange status */}
        <div className="flex items-center gap-2 flex-wrap">
          {EXCHANGES.map(e => (
            <div key={e.name} className="flex items-center gap-1 text-xs">
              <span className={`w-1.5 h-1.5 rounded-full ${connected[e.name] ? 'bg-emerald-400 animate-pulse' : 'bg-red-500/60'}`} />
              <span className={EXCHANGE_COLORS[e.name] ?? 'text-slate-400'}>{e.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Buy/Sell pressure */}
      {totalVol > 0 && (
        <div className="px-4 py-2 border-b border-white/5 flex-shrink-0">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-emerald-400 font-medium">Buy {buyPct}%</span>
            <span className={buyPct > 55 ? 'text-emerald-400' : buyPct < 45 ? 'text-red-400' : 'text-slate-400'}>
              {buyPct > 55 ? '↑ Buying pressure' : buyPct < 45 ? '↓ Selling pressure' : '→ Balanced'}
            </span>
            <span className="text-red-400 font-medium">Sell {100 - buyPct}%</span>
          </div>
          <div className="flex h-1.5 rounded-full overflow-hidden">
            <div className="bg-emerald-500 transition-all duration-500" style={{ width: `${buyPct}%` }} />
            <div className="bg-red-500 transition-all duration-500"     style={{ width: `${100 - buyPct}%` }} />
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="px-4 py-2 border-b border-white/5 flex-shrink-0 space-y-2">
        <div className="flex gap-1">
          {(['all', 'large', 'whale'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all cursor-pointer ${filter === f ? 'bg-white/10 border-white/15 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
              {f === 'all' ? 'All $10K+' : f === 'large' ? '🦈 $100K+' : '🐋 $1M+'}
            </button>
          ))}
        </div>
        {topSymbols.length > 0 && (
          <div className="flex gap-1 flex-wrap">
            <button onClick={() => setSymFilter('ALL')}
              className={`px-2 py-0.5 rounded text-xs border transition-all cursor-pointer ${symFilter === 'ALL' ? 'bg-white/10 border-white/15 text-white' : 'border-transparent text-slate-600 hover:text-slate-400'}`}>
              ALL
            </button>
            {topSymbols.map(s => (
              <button key={s} onClick={() => setSymFilter(symFilter === s ? 'ALL' : s)}
                className={`px-2 py-0.5 rounded text-xs border font-mono transition-all cursor-pointer ${symFilter === s ? 'bg-white/10 border-white/15 text-white' : 'border-transparent text-slate-600 hover:text-slate-400'}`}>
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Live feed */}
      <div className="flex-1 overflow-y-auto max-h-80 divide-y divide-white/3">
        {displayed.length === 0 ? (
          <div className="py-8 text-center text-slate-500 text-xs">
            {connCount > 0
              ? `Streaming crypto trades ($10K+) from ${connCount} exchanges…`
              : 'Connecting to crypto exchanges…'}
          </div>
        ) : displayed.map(t => (
          <div key={t.id} className={`px-3 py-2 hover:bg-white/2 transition-colors flex items-center gap-2 ${
            t.tag === 'mega' ? 'bg-yellow-500/5 border-l-2 border-yellow-500/50' :
            t.tag === 'whale' ? 'bg-purple-500/5 border-l-2 border-purple-500/40' :
            t.tag === 'large' ? 'border-l-2 border-blue-500/30' :
            t.type === 'buy' ? 'border-l border-emerald-500/20' : 'border-l border-red-500/20'
          }`}>
            {/* Direction */}
            <span className={`text-xs font-bold w-3 flex-shrink-0 ${t.type === 'buy' ? 'text-emerald-400' : 'text-red-400'}`}>
              {t.type === 'buy' ? '▲' : '▼'}
            </span>
            {/* Symbol */}
            <span className="font-mono text-xs font-bold text-white w-10 flex-shrink-0">{t.symbol}</span>
            {/* USD value */}
            <span className={`font-mono text-xs font-bold flex-shrink-0 ${
              t.tag === 'mega' ? 'text-yellow-300' :
              t.tag === 'whale' ? 'text-purple-300' :
              t.tag === 'large' ? 'text-blue-300' :
              t.type === 'buy' ? 'text-emerald-400' : 'text-red-400'
            }`}>{t.usdDisplay}</span>
            {/* Tag label */}
            {tagLabel(t.tag) && (
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border flex-shrink-0 ${tagStyle(t.tag)}`}>
                {tagLabel(t.tag)}
              </span>
            )}
            {/* Exchange */}
            <span className={`text-[10px] flex-shrink-0 ${EXCHANGE_COLORS[t.exchange] ?? 'text-slate-500'}`}>{t.exchange}</span>
            <div className="flex-1" />
            {/* Time */}
            <span className="text-[10px] text-slate-600 flex-shrink-0">{t.timeAgo}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
