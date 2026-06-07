'use client';
import { useState, useEffect, useRef, useCallback } from 'react';

interface WhaleMove {
  id: string;
  type: 'buy' | 'sell' | 'transfer';
  symbol: string;
  usd: number;
  usdDisplay: string;
  qty: string;
  exchange: string;       // exchange name OR 'On-Chain BTC' / 'On-Chain ETH'
  wallet?: string;        // truncated wallet/tx hash for on-chain
  txHash?: string;
  time: Date;
  timeAgo: string;
  tag: 'mega' | 'whale' | 'large';
}

function fmtUSD(v: number) {
  if (v >= 1e9) return '$' + (v / 1e9).toFixed(2) + 'B';
  if (v >= 1e6) return '$' + (v / 1e6).toFixed(2) + 'M';
  return '$' + (v / 1e3).toFixed(0) + 'K';
}

function getTag(usd: number): WhaleMove['tag'] {
  if (usd >= 10_000_000) return 'mega';
  if (usd >= 5_000_000)  return 'whale';
  return 'large';
}

function tagStyle(tag: WhaleMove['tag']) {
  if (tag === 'mega')  return 'text-yellow-300 bg-yellow-500/15 border-yellow-500/40';
  if (tag === 'whale') return 'text-purple-300 bg-purple-500/15 border-purple-500/40';
  return 'text-blue-300 bg-blue-500/10 border-blue-500/30';
}

function tagLabel(tag: WhaleMove['tag']) {
  if (tag === 'mega')  return '🐳 MEGA';
  if (tag === 'whale') return '🐋 WHALE';
  return '🦈 LARGE';
}

function ago(t: Date, now: Date) {
  const d = Math.floor((now.getTime() - t.getTime()) / 1000);
  if (d < 10)   return 'now';
  if (d < 60)   return d + 's';
  if (d < 3600) return Math.floor(d / 60) + 'm';
  return Math.floor(d / 3600) + 'h';
}

function shortAddr(s: string) {
  if (!s) return '';
  return s.slice(0, 6) + '…' + s.slice(-4);
}

// ── Exchange CEX configs — trades $1M+ only ─────────────────────────────────
const CEX_SYMBOLS = ['BTC','ETH','SOL','XRP','BNB','ADA','DOGE','AVAX','DOT','MATIC'];

const CEX_MIN_USD = 1_000_000; // $1M minimum for exchange trades

interface ExCfg {
  name: string;
  url: string;
  onOpen: (ws: WebSocket) => void;
  parse: (raw: string) => { symbol: string; price: number; qty: number; isSell: boolean; ts: number; id: string } | null;
}

const EXCHANGES: ExCfg[] = [
  {
    name: 'Binance',
    url: `wss://stream.binance.com:9443/stream?streams=${CEX_SYMBOLS.map(s => s.toLowerCase() + 'usdt@aggTrade').join('/')}`,
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
      const args = ['BTC','ETH','SOL','XRP','BNB','ADA'].map(s => `publicTrade.${s}USDT`);
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
      const args = ['BTC','ETH','SOL','XRP','ADA','DOT'].map(s => ({ channel: 'trades', instId: `${s}-USDT` }));
      ws.send(JSON.stringify({ op: 'subscribe', args }));
    },
    parse: (raw) => {
      try {
        const msg = JSON.parse(raw);
        if (!msg.data || !Array.isArray(msg.data)) return null;
        const t = msg.data[0];
        if (!t?.instId) return null;
        return { symbol: t.instId.replace('-USDT',''), price: parseFloat(t.px), qty: parseFloat(t.sz), isSell: t.side === 'sell', ts: Number(t.ts), id: `okx-${t.tradeId}` };
      } catch { return null; }
    },
  },
  {
    name: 'Coinbase',
    url: 'wss://advanced-trade-ws.coinbase.com',
    onOpen: (ws) => {
      ws.send(JSON.stringify({ type: 'subscribe', product_ids: ['BTC-USD','ETH-USD','SOL-USD','XRP-USD','DOGE-USD'], channel: 'market_trades' }));
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
      ws.send(JSON.stringify({ method: 'subscribe', params: { channel: 'trade', symbol: ['BTC/USD','ETH/USD','SOL/USD','XRP/USD'] } }));
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

const EX_COLORS: Record<string, string> = {
  Binance: 'text-amber-400', Bybit: 'text-orange-400',
  OKX: 'text-blue-400', Coinbase: 'text-blue-300', Kraken: 'text-purple-400',
  'On-Chain BTC': 'text-orange-300', 'On-Chain ETH': 'text-indigo-300',
};

// Approximate BTC price for on-chain USD estimation (updated from last trade)
let btcPriceRef = 100_000;
let ethPriceRef = 3_500;

export default function WhaleTracker() {
  const [moves, setMoves]         = useState<WhaleMove[]>([]);
  const [connected, setConnected] = useState<Record<string, boolean>>({});
  const [sessionVol, setSessionVol] = useState(0);
  const [filter, setFilter]       = useState<'all' | 'cex' | 'onchain'>('all');
  const movesRef  = useRef<WhaleMove[]>([]);
  const wsRefs    = useRef<Map<string, WebSocket>>(new Map());
  const seenIds   = useRef<Set<string>>(new Set());

  const push = useCallback((move: WhaleMove) => {
    if (seenIds.current.has(move.id)) return;
    seenIds.current.add(move.id);
    if (seenIds.current.size > 5000) {
      const arr = [...seenIds.current];
      seenIds.current = new Set(arr.slice(1000));
    }
    movesRef.current = [move, ...movesRef.current].slice(0, 80);
    setMoves([...movesRef.current]);
    setSessionVol(v => v + move.usd);
  }, []);

  // ── CEX exchange feeds ───────────────────────────────────────────────────
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
        if (usd < CEX_MIN_USD) return;

        // Track live prices for on-chain estimation
        if (symbol === 'BTC') btcPriceRef = price;
        if (symbol === 'ETH') ethPriceRef = price;

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

  // ── On-chain BTC via blockchain.info WebSocket ───────────────────────────
  // Streams ALL unconfirmed BTC transactions in real-time
  const connectBTCOnChain = useCallback(() => {
    if (typeof window === 'undefined') return;
    const MIN_BTC = 5; // minimum 5 BTC (~$500K at $100K/BTC)
    try {
      const ws = new WebSocket('wss://ws.blockchain.info/inv');
      wsRefs.current.set('btc-onchain', ws);
      ws.onopen = () => {
        ws.send(JSON.stringify({ op: 'unconfirmed_sub' }));
        setConnected(p => ({ ...p, 'On-Chain BTC': true }));
      };
      ws.onclose = () => {
        setConnected(p => ({ ...p, 'On-Chain BTC': false }));
        setTimeout(() => connectBTCOnChain(), 8000);
      };
      ws.onerror = () => ws.close();
      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          if (msg.op !== 'utx' || !msg.x) return;
          const tx = msg.x;
          // Total output value in satoshis (1 BTC = 1e8 satoshis)
          const totalSats: number = (tx.out ?? []).reduce((sum: number, o: { value: number }) => sum + (o.value ?? 0), 0);
          const btc = totalSats / 1e8;
          if (btc < MIN_BTC) return;
          const usd = btc * btcPriceRef;
          if (usd < 500_000) return;

          push({
            id: `btc-${tx.hash}`,
            type: 'transfer',
            symbol: 'BTC',
            usd,
            usdDisplay: fmtUSD(usd),
            qty: btc.toFixed(4) + ' BTC',
            exchange: 'On-Chain BTC',
            wallet: shortAddr(tx.hash ?? ''),
            txHash: tx.hash,
            time: new Date((tx.time ?? Math.floor(Date.now() / 1000)) * 1000),
            timeAgo: 'now',
            tag: getTag(usd),
          });
        } catch {}
      };
    } catch {}
  }, [push]);

  // ── On-chain via mempool.space (large confirmed BTC txns) ────────────────
  const connectMempool = useCallback(() => {
    if (typeof window === 'undefined') return;
    try {
      const ws = new WebSocket('wss://mempool.space/api/v1/ws');
      wsRefs.current.set('mempool', ws);
      ws.onopen = () => {
        ws.send(JSON.stringify({ action: 'want', data: ['blocks'] }));
        setConnected(p => ({ ...p, 'Mempool': true }));
      };
      ws.onclose = () => {
        setConnected(p => ({ ...p, 'Mempool': false }));
        setTimeout(() => connectMempool(), 10000);
      };
      ws.onerror = () => ws.close();
      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          // On new block, check for large transactions
          if (msg.block?.tx) {
            for (const tx of msg.block.tx.slice(0, 50)) {
              const totalSats: number = (tx.vout ?? []).reduce((s: number, o: { value: number }) => s + (o.value ?? 0), 0);
              const btc = totalSats / 1e8;
              if (btc < 10) continue;
              const usd = btc * btcPriceRef;
              if (usd < 1_000_000) continue;
              push({
                id: `mp-${tx.txid}`,
                type: 'transfer',
                symbol: 'BTC',
                usd,
                usdDisplay: fmtUSD(usd),
                qty: btc.toFixed(4) + ' BTC',
                exchange: 'On-Chain BTC',
                wallet: shortAddr(tx.txid ?? ''),
                txHash: tx.txid,
                time: new Date(),
                timeAgo: 'now',
                tag: getTag(usd),
              });
            }
          }
        } catch {}
      };
    } catch {}
  }, [push]);

  useEffect(() => {
    EXCHANGES.forEach(cfg => connectCEX(cfg));
    connectBTCOnChain();
    connectMempool();

    const tick = setInterval(() => {
      const now = new Date();
      movesRef.current = movesRef.current.map(m => ({ ...m, timeAgo: ago(m.time, now) }));
      setMoves([...movesRef.current]);
    }, 10_000);

    return () => {
      wsRefs.current.forEach(ws => { try { ws.close(); } catch {} });
      clearInterval(tick);
    };
  }, [connectCEX, connectBTCOnChain, connectMempool]);

  const connCEX     = EXCHANGES.filter(e => connected[e.name]).length;
  const connOnChain = (connected['On-Chain BTC'] ? 1 : 0) + (connected['Mempool'] ? 1 : 0);

  const displayed = (filter === 'cex'     ? moves.filter(m => m.exchange !== 'On-Chain BTC')
                   : filter === 'onchain' ? moves.filter(m => m.exchange === 'On-Chain BTC')
                   : moves);

  const buyVol  = moves.filter(m => m.type === 'buy').reduce((s, m) => s + m.usd, 0);
  const sellVol = moves.filter(m => m.type === 'sell').reduce((s, m) => s + m.usd, 0);
  const totalVol = buyVol + sellVol;
  const buyPct  = totalVol > 0 ? Math.round((buyVol / totalVol) * 100) : 50;

  return (
    <div className="bg-white/2 border border-white/8 rounded-2xl overflow-hidden flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/5 flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${connCEX + connOnChain > 0 ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
            <span className="text-sm font-semibold text-white">Whale Activity</span>
            <span className="text-xs text-slate-500">$1M+ moves</span>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-slate-600">Session vol</div>
            <div className="text-xs font-mono font-bold text-amber-400">{fmtUSD(sessionVol)}</div>
          </div>
        </div>

        {/* Connection status */}
        <div className="flex items-center gap-3 flex-wrap text-[10px]">
          <div className="flex items-center gap-1">
            <span className={`w-1.5 h-1.5 rounded-full ${connCEX > 0 ? 'bg-emerald-400 animate-pulse' : 'bg-red-500/60'}`} />
            <span className="text-slate-400">CEX {connCEX}/{EXCHANGES.length}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className={`w-1.5 h-1.5 rounded-full ${connected['On-Chain BTC'] ? 'bg-orange-400 animate-pulse' : 'bg-slate-600'}`} />
            <span className="text-orange-300/70">BTC On-Chain</span>
          </div>
          <div className="flex items-center gap-1">
            <span className={`w-1.5 h-1.5 rounded-full ${connected['Mempool'] ? 'bg-orange-400 animate-pulse' : 'bg-slate-600'}`} />
            <span className="text-orange-300/70">Mempool</span>
          </div>
        </div>
      </div>

      {/* Buy/Sell pressure */}
      {totalVol > 0 && (
        <div className="px-4 py-2 border-b border-white/5 flex-shrink-0">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-emerald-400 font-mono">{buyPct}% buy {fmtUSD(buyVol)}</span>
            <span className="text-red-400 font-mono">{fmtUSD(sellVol)} sell {100-buyPct}%</span>
          </div>
          <div className="flex h-1.5 rounded-full overflow-hidden">
            <div className="bg-emerald-500 transition-all duration-1000" style={{ width: `${buyPct}%` }} />
            <div className="bg-red-500 transition-all duration-1000"     style={{ width: `${100 - buyPct}%` }} />
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="px-4 py-2 border-b border-white/5 flex gap-1 flex-shrink-0">
        {(['all','cex','onchain'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-2.5 py-1 rounded-lg text-xs border transition-all cursor-pointer ${filter === f ? 'bg-white/10 border-white/15 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
            {f === 'all' ? 'All' : f === 'cex' ? '📊 Exchange' : '⛓️ On-Chain'}
          </button>
        ))}
      </div>

      {/* Feed */}
      <div className="flex-1 overflow-y-auto max-h-80 divide-y divide-white/3">
        {displayed.length === 0 ? (
          <div className="py-8 text-center text-slate-600 text-xs">
            {connCEX + connOnChain > 0
              ? 'Watching for whale moves ($1M+)… large trades appear here in real time'
              : 'Connecting to exchange feeds and blockchain…'}
          </div>
        ) : displayed.map(m => (
          <div key={m.id} className={`px-3 py-2.5 hover:bg-white/2 transition-colors ${
            m.tag === 'mega'  ? 'bg-yellow-500/5 border-l-2 border-yellow-500/60' :
            m.tag === 'whale' ? 'bg-purple-500/5 border-l-2 border-purple-500/50' :
            'border-l-2 border-blue-500/30'
          }`}>
            <div className="flex items-center gap-2 mb-1">
              {/* Direction / type */}
              {m.type === 'transfer' ? (
                <span className="text-orange-300 text-xs font-bold w-4">⇄</span>
              ) : (
                <span className={`text-xs font-bold w-4 ${m.type === 'buy' ? 'text-emerald-400' : 'text-red-400'}`}>
                  {m.type === 'buy' ? '▲' : '▼'}
                </span>
              )}
              <span className="font-mono text-xs font-bold text-white w-10">{m.symbol}</span>
              <span className={`font-mono text-sm font-bold ${
                m.tag === 'mega' ? 'text-yellow-300' : m.tag === 'whale' ? 'text-purple-300' : 'text-blue-300'
              }`}>{m.usdDisplay}</span>
              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${tagStyle(m.tag)}`}>{tagLabel(m.tag)}</span>
              <div className="flex-1" />
              <span className="text-[10px] text-slate-600">{m.timeAgo}</span>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-slate-500 pl-6">
              <span className={EX_COLORS[m.exchange] ?? 'text-slate-400'}>{m.exchange}</span>
              <span>·</span>
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
        ))}
      </div>
    </div>
  );
}
