'use client';
// Headless whale data collector — mounted once in the root layout so whale
// data accumulates while the user is ANYWHERE in the app, not just on the
// dashboard. Stats persist to localStorage via useWhaleStore.
import { useEffect } from 'react';
import { useWhaleStore, type WhaleMove } from '@/store/useWhaleStore';

const ALL_SYMBOLS = ['BTC','ETH','SOL','XRP','BNB','ADA','DOGE','AVAX','DOT','MATIC','LINK','LTC','UNI','ATOM','TRX'];
const CEX_MIN_USD = 500_000;

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
function shortAddr(s: string) { return s ? s.slice(0, 6) + '…' + s.slice(-4) : ''; }

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

export const WHALE_EXCHANGES = EXCHANGES.map(e => e.name);

// Module-level singleton guard — survives React StrictMode double-mount
let started = false;
let btcPrice = 100_000;
const seenIds = new Set<string>();

export default function WhaleCollector() {
  useEffect(() => {
    if (started || typeof window === 'undefined') return;
    started = true;

    const { pushMove, bumpStat, setConnected, setFlash } = useWhaleStore.getState();
    const sockets: WebSocket[] = [];

    const push = (m: WhaleMove) => {
      if (seenIds.has(m.id)) return;
      seenIds.add(m.id);
      if (seenIds.size > 8000) {
        const arr = [...seenIds];
        seenIds.clear();
        arr.slice(arr.length - 2000).forEach(x => seenIds.add(x));
      }
      pushMove(m);
      bumpStat(m.symbol, m.usd, m.type);
      setFlash(m.symbol, m.type === 'buy' ? 'buy' : m.type === 'sell' ? 'sell' : null);
      setTimeout(() => setFlash(m.symbol, null), 800);
    };

    const connectCEX = (cfg: ExCfg) => {
      try {
        const ws = new WebSocket(cfg.url);
        sockets.push(ws);
        ws.onopen  = () => { cfg.onOpen(ws); setConnected(cfg.name, true); };
        ws.onclose = () => { setConnected(cfg.name, false); setTimeout(() => connectCEX(cfg), 5000); };
        ws.onerror = () => ws.close();
        ws.onmessage = (evt) => {
          const parsed = cfg.parse(evt.data);
          if (!parsed) return;
          const { symbol, price, qty, isSell, ts, id } = parsed;
          if (!symbol || price <= 0 || qty <= 0) return;
          const usd = price * qty;
          if (symbol === 'BTC') btcPrice = price;

          // $50K+ trades feed coin stats (pressure bars + heat map)
          if (usd >= 50_000 && usd < CEX_MIN_USD) {
            bumpStat(symbol, usd, isSell ? 'sell' : 'buy');
          }

          // $500K+ goes to the whale feed
          if (usd < CEX_MIN_USD || seenIds.has(id)) return;
          push({
            id, type: isSell ? 'sell' : 'buy', symbol, usd,
            usdDisplay: fmtUSD(usd),
            qty: qty.toFixed(symbol === 'BTC' ? 4 : 2) + ' ' + symbol,
            exchange: cfg.name,
            time: ts || Date.now(),
            tag: getTag(usd),
          });
        };
      } catch {}
    };

    const connectBTCOnChain = () => {
      try {
        const ws = new WebSocket('wss://ws.blockchain.info/inv');
        sockets.push(ws);
        ws.onopen = () => { ws.send(JSON.stringify({ op: 'unconfirmed_sub' })); setConnected('On-Chain BTC', true); };
        ws.onclose = () => { setConnected('On-Chain BTC', false); setTimeout(connectBTCOnChain, 8000); };
        ws.onerror = () => ws.close();
        ws.onmessage = (evt) => {
          try {
            const msg = JSON.parse(evt.data);
            if (msg.op !== 'utx' || !msg.x) return;
            const totalSats: number = (msg.x.out ?? []).reduce((s: number, o: { value: number }) => s + (o.value ?? 0), 0);
            const btc = totalSats / 1e8;
            if (btc < 5) return;
            const usd = btc * btcPrice;
            if (usd < 500_000) return;
            push({
              id: `btc-${msg.x.hash}`, type: 'transfer', symbol: 'BTC', usd,
              usdDisplay: fmtUSD(usd), qty: btc.toFixed(4) + ' BTC',
              exchange: 'On-Chain BTC', wallet: shortAddr(msg.x.hash ?? ''), txHash: msg.x.hash,
              time: (msg.x.time ?? Math.floor(Date.now() / 1000)) * 1000,
              tag: getTag(usd),
            });
          } catch {}
        };
      } catch {}
    };

    EXCHANGES.forEach(connectCEX);
    connectBTCOnChain();

    // Intentionally no cleanup — this collector lives for the whole session.
  }, []);

  return null;
}
