'use client';
import { useEffect, useRef } from 'react';
import { useDemoStore } from '@/store/useDemoStore';

export default function OpenPositions() {
  const { trades, closeTrade, updateOpenPnl } = useDemoStore();
  const openTrades = trades.filter(t => t.status === 'OPEN');
  const wsRefs = useRef<Map<string, WebSocket>>(new Map());

  // Binance WebSocket price feeds for each open crypto trade
  useEffect(() => {
    const existingIds = new Set(wsRefs.current.keys());
    const openIds = new Set(openTrades.map(t => t.id));

    // Close WS for closed trades
    for (const id of existingIds) {
      if (!openIds.has(id)) {
        wsRefs.current.get(id)?.close();
        wsRefs.current.delete(id);
      }
    }

    // Open WS for new crypto trades
    for (const trade of openTrades) {
      if (trade.market !== 'crypto') continue;
      if (wsRefs.current.has(trade.id)) continue;
      const symbol = trade.pairId.replace('/', '').toUpperCase();
      // Map pairId to binance symbol
      const binanceSym = symbol.endsWith('USDT') ? symbol : symbol + 'USDT';
      try {
        const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${binanceSym.toLowerCase()}@ticker`);
        ws.onmessage = (e) => {
          const d = JSON.parse(e.data);
          updateOpenPnl(trade.id, parseFloat(d.c));
        };
        wsRefs.current.set(trade.id, ws);
      } catch {}
    }

    return () => {};
  }, [openTrades.length]);

  // Poll forex/stocks every 30s
  useEffect(() => {
    const nonCrypto = openTrades.filter(t => t.market !== 'crypto');
    if (nonCrypto.length === 0) return;

    const poll = async () => {
      for (const trade of nonCrypto) {
        try {
          const res = await fetch(`/api/ohlcv/${trade.pairId}?tf=1m`);
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            updateOpenPnl(trade.id, data[data.length - 1].close);
          }
        } catch {}
      }
    };

    poll();
    const iv = setInterval(poll, 30000);
    return () => clearInterval(iv);
  }, [openTrades.length]);

  if (openTrades.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500 text-sm">
        No open positions — place a trade to get started
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-slate-500 border-b border-white/5">
            <th className="text-left pb-2 pr-4">Pair</th>
            <th className="text-left pb-2 pr-4">Dir</th>
            <th className="text-right pb-2 pr-4">Entry</th>
            <th className="text-right pb-2 pr-4">SL</th>
            <th className="text-right pb-2 pr-4">TP</th>
            <th className="text-right pb-2 pr-4">Units</th>
            <th className="text-right pb-2 pr-4">Risk $</th>
            <th className="text-right pb-2 pr-4">P&L</th>
            <th className="text-right pb-2">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/3">
          {openTrades.map(trade => {
            const pnlColor = trade.pnl >= 0 ? 'text-emerald-400' : 'text-red-400';
            return (
              <tr key={trade.id} className="hover:bg-white/2 transition-colors">
                <td className="py-2.5 pr-4">
                  <div className="font-mono font-semibold text-white text-xs">{trade.pairName}</div>
                  <div className="text-xs text-slate-500">{trade.market}</div>
                </td>
                <td className="py-2.5 pr-4">
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${trade.direction === 'LONG' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                    {trade.direction}
                  </span>
                </td>
                <td className="py-2.5 pr-4 text-right font-mono text-xs text-white">{trade.entryPrice.toFixed(5)}</td>
                <td className="py-2.5 pr-4 text-right font-mono text-xs text-red-400">{trade.sl.toFixed(5)}</td>
                <td className="py-2.5 pr-4 text-right font-mono text-xs text-emerald-400">{trade.tp.toFixed(5)}</td>
                <td className="py-2.5 pr-4 text-right font-mono text-xs text-slate-300">{trade.units.toLocaleString()}</td>
                <td className="py-2.5 pr-4 text-right font-mono text-xs text-slate-300">${trade.riskAmount.toFixed(2)}</td>
                <td className={`py-2.5 pr-4 text-right font-mono text-xs font-bold ${pnlColor}`}>
                  {trade.pnl >= 0 ? '+' : ''}${trade.pnl.toFixed(2)}
                </td>
                <td className="py-2.5 text-right">
                  <button onClick={() => {
                    const price = trade.entryPrice; // Will be closed at current — in real usage price comes from WS
                    closeTrade(trade.id, price);
                  }}
                    className="text-xs text-slate-500 hover:text-white border border-white/8 hover:border-white/20 rounded px-2 py-1 transition-all">
                    Close
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
