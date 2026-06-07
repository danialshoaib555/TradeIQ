'use client';
import { useState, useEffect } from 'react';
import { useDemoStore, type TradeDirection, type EmotionTag } from '@/store/useDemoStore';
import { getPairById, PAIRS } from '@/lib/pairConfig';

const EMOTIONS: { value: EmotionTag; label: string; color: string }[] = [
  { value: 'disciplined', label: 'Disciplined', color: 'text-emerald-400' },
  { value: 'confident', label: 'Confident', color: 'text-sky-400' },
  { value: 'fearful', label: 'Fearful', color: 'text-amber-400' },
  { value: 'greedy', label: 'Greedy', color: 'text-red-400' },
  { value: 'neutral', label: 'Neutral', color: 'text-slate-400' },
];

export default function DemoTradeForm() {
  const { balance, openTrade } = useDemoStore();
  const [pairId, setPairId] = useState('eurusd');
  const [direction, setDirection] = useState<TradeDirection>('LONG');
  const [entryPrice, setEntryPrice] = useState('');
  const [sl, setSl] = useState('');
  const [tp, setTp] = useState('');
  const [riskPct, setRiskPct] = useState('2');
  const [emotion, setEmotion] = useState<EmotionTag>('neutral');
  const [note, setNote] = useState('');
  const [strategy, setStrategy] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [livePrice, setLivePrice] = useState<number | null>(null);

  const pair = getPairById(pairId);

  // Fetch live price for selected pair
  useEffect(() => {
    if (!pair) return;
    let ws: WebSocket | null = null;
    let cancelled = false;

    const fetchPrice = async () => {
      try {
        if (pair.market === 'crypto' && pair.binanceSymbol) {
          const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${pair.binanceSymbol.toUpperCase()}`);
          if (!cancelled) {
            const data = await res.json();
            setLivePrice(parseFloat(data.price));
          }
          // WebSocket for live updates
          ws = new WebSocket(`wss://stream.binance.com:9443/ws/${pair.binanceSymbol.toLowerCase()}@ticker`);
          ws.onmessage = (e) => {
            if (cancelled) return;
            const d = JSON.parse(e.data);
            setLivePrice(parseFloat(d.c));
          };
        } else if (pair.ticker) {
          const res = await fetch(`/api/ohlcv/${pair.id}?tf=1m`);
          if (!cancelled) {
            const data = await res.json();
            if (Array.isArray(data) && data.length > 0) {
              setLivePrice(data[data.length - 1].close);
            }
          }
        }
      } catch {}
    };

    fetchPrice();
    return () => { cancelled = true; ws?.close(); };
  }, [pairId, pair]);

  const pipSize = pair?.pipSize ?? 0.0001;
  const entry = parseFloat(entryPrice) || livePrice || 0;
  const slVal = parseFloat(sl) || 0;
  const tpVal = parseFloat(tp) || 0;
  const riskAmount = (parseFloat(riskPct) / 100) * balance;

  const slPips = slVal && entry ? Math.abs(entry - slVal) / pipSize : 0;
  const tpPips = tpVal && entry ? Math.abs(tpVal - entry) / pipSize : 0;
  const rr = slPips > 0 && tpPips > 0 ? tpPips / slPips : 0;
  const units = slPips > 0 ? riskAmount / (slPips * pipSize) : 0;
  const lotSize = pair?.market === 'crypto' ? units : units / 100000;

  const canSubmit = entry > 0 && slVal > 0 && tpVal > 0 && parseFloat(riskPct) > 0 && parseFloat(riskPct) <= 10;

  const handleSubmit = () => {
    if (!pair || !canSubmit) return;
    openTrade({
      pairId: pair.id,
      pairName: pair.name,
      direction,
      entryPrice: entry,
      sl: slVal,
      tp: tpVal,
      lotSize: Math.round(lotSize * 100) / 100,
      units: Math.round(units),
      riskAmount: Math.round(riskAmount * 100) / 100,
      riskReward: Math.round(rr * 10) / 10,
      pipSize,
      market: pair.market,
      emotion,
      note: note || undefined,
      strategy: strategy || undefined,
    });
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 2000);
    setNote('');
  };

  const useMarket = () => {
    if (livePrice) setEntryPrice(livePrice.toFixed(pair?.market === 'crypto' ? 2 : 5));
  };

  const autoSL = () => {
    if (!entry) return;
    const slDist = entry * 0.005; // 0.5% from entry
    setSl(direction === 'LONG' ? (entry - slDist).toFixed(5) : (entry + slDist).toFixed(5));
  };

  const autoTP = () => {
    if (!entry || !slVal) return;
    const dist = Math.abs(entry - slVal) * 2;
    setTp(direction === 'LONG' ? (entry + dist).toFixed(5) : (entry - dist).toFixed(5));
  };

  return (
    <div className="bg-slate-800/40 rounded-xl border border-white/5 p-4 space-y-4">
      <p className="text-sm font-semibold text-white">Open Demo Trade</p>

      {/* Pair selector */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Pair</label>
          <select value={pairId} onChange={e => setPairId(e.target.value)}
            className="w-full bg-slate-900/60 border border-white/8 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-emerald-500/40">
            {PAIRS.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Direction</label>
          <div className="flex gap-2">
            <button onClick={() => setDirection('LONG')}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${direction === 'LONG' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-900/60 text-slate-400 border border-white/8'}`}>
              LONG
            </button>
            <button onClick={() => setDirection('SHORT')}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${direction === 'SHORT' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-slate-900/60 text-slate-400 border border-white/8'}`}>
              SHORT
            </button>
          </div>
        </div>
      </div>

      {/* Price + live */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs text-slate-400">Entry Price</label>
            {livePrice && (
              <button onClick={useMarket} className="text-xs text-emerald-400 hover:text-emerald-300">
                Use live {livePrice.toFixed(pair?.market === 'crypto' ? 2 : 5)}
              </button>
            )}
          </div>
          <input value={entryPrice} onChange={e => setEntryPrice(e.target.value)} placeholder={livePrice?.toFixed(5) ?? '0.00000'}
            className="w-full bg-slate-900/60 border border-white/8 rounded-lg px-3 py-2 text-sm text-white font-mono outline-none focus:border-emerald-500/40" />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs text-slate-400">Stop Loss</label>
            <button onClick={autoSL} className="text-xs text-amber-400 hover:text-amber-300">Auto</button>
          </div>
          <input value={sl} onChange={e => setSl(e.target.value)} placeholder="0.00000"
            className="w-full bg-slate-900/60 border border-white/8 rounded-lg px-3 py-2 text-sm text-white font-mono outline-none focus:border-red-500/30" />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs text-slate-400">Take Profit</label>
            <button onClick={autoTP} className="text-xs text-emerald-400 hover:text-emerald-300">Auto 1:2</button>
          </div>
          <input value={tp} onChange={e => setTp(e.target.value)} placeholder="0.00000"
            className="w-full bg-slate-900/60 border border-white/8 rounded-lg px-3 py-2 text-sm text-white font-mono outline-none focus:border-emerald-500/40" />
        </div>
      </div>

      {/* Risk + calculated */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Risk % (max 10%)</label>
          <input value={riskPct} onChange={e => setRiskPct(e.target.value)} type="number" min="0.1" max="10" step="0.1"
            className="w-full bg-slate-900/60 border border-white/8 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-emerald-500/40" />
        </div>
        <div className="bg-slate-900/40 rounded-lg p-3 border border-white/5">
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
            <span className="text-slate-500">Risk $</span><span className="text-white font-mono">${riskAmount.toFixed(2)}</span>
            <span className="text-slate-500">R:R</span><span className={`font-mono ${rr >= 2 ? 'text-emerald-400' : rr >= 1 ? 'text-amber-400' : 'text-red-400'}`}>1:{rr.toFixed(1)}</span>
            <span className="text-slate-500">Units</span><span className="text-white font-mono">{Math.round(units).toLocaleString()}</span>
            <span className="text-slate-500">SL pips</span><span className="text-white font-mono">{slPips.toFixed(1)}</span>
          </div>
        </div>
      </div>

      {/* Strategy + emotion */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Strategy (optional)</label>
          <input value={strategy} onChange={e => setStrategy(e.target.value)} placeholder="e.g. Breakout, RSI divergence"
            className="w-full bg-slate-900/60 border border-white/8 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-emerald-500/40" />
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Emotion</label>
          <select value={emotion} onChange={e => setEmotion(e.target.value as EmotionTag)}
            className="w-full bg-slate-900/60 border border-white/8 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-emerald-500/40">
            {EMOTIONS.map(em => <option key={em.value} value={em.value}>{em.label}</option>)}
          </select>
        </div>
      </div>

      {/* Note */}
      <div>
        <label className="text-xs text-slate-400 mb-1 block">Trade Note</label>
        <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="Why are you taking this trade?"
          className="w-full bg-slate-900/60 border border-white/8 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-emerald-500/40 resize-none" />
      </div>

      {/* Submit */}
      <button onClick={handleSubmit} disabled={!canSubmit}
        className={`w-full py-2.5 rounded-lg text-sm font-bold transition-all ${
          submitted ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-500/30'
          : canSubmit
            ? direction === 'LONG'
              ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30'
              : 'bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30'
            : 'bg-slate-800 text-slate-600 border border-white/5 cursor-not-allowed'
        }`}>
        {submitted ? 'Trade Opened!' : `Open ${direction} ${pair?.name ?? ''}`}
      </button>
    </div>
  );
}
