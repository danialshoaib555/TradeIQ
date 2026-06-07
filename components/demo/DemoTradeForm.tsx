'use client';
import { useState, useEffect } from 'react';
import { useDemoStore, type TradeDirection, type EmotionTag } from '@/store/useDemoStore';
import { getPairById, PAIRS } from '@/lib/pairConfig';
import { calculateSignal } from '@/lib/signalEngine';
import { calculateLevels } from '@/lib/levelCalculator';

const EMOTIONS: { value: EmotionTag; label: string }[] = [
  { value: 'disciplined', label: 'Disciplined' },
  { value: 'confident', label: 'Confident' },
  { value: 'fearful', label: 'Fearful' },
  { value: 'greedy', label: 'Greedy' },
  { value: 'neutral', label: 'Neutral' },
];

interface SignalSuggestion {
  signal: 'BUY' | 'SELL' | 'WAIT';
  confidence: number;
  reasons: string[];
  entry: number;
  sl: number;
  tp1: number;
  tp2: number;
  tp3: number;
  rr: number;
  riskPips: number;
  selectedTp: 'tp1' | 'tp2' | 'tp3';
}

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
  const [signalLoading, setSignalLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<SignalSuggestion | null>(null);
  const [signalError, setSignalError] = useState('');

  const pair = getPairById(pairId);

  // Live price feed
  useEffect(() => {
    if (!pair) return;
    let ws: WebSocket | null = null;
    let cancelled = false;
    setSuggestion(null);
    setSignalError('');

    const fetchPrice = async () => {
      try {
        if (pair.market === 'crypto' && pair.binanceSymbol) {
          const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${pair.binanceSymbol.toUpperCase()}`);
          if (!cancelled) {
            const data = await res.json();
            setLivePrice(parseFloat(data.price));
          }
          ws = new WebSocket(`wss://stream.binance.com:9443/ws/${pair.binanceSymbol.toLowerCase()}@ticker`);
          ws.onmessage = (e) => {
            if (cancelled) return;
            const d = JSON.parse(e.data);
            setLivePrice(parseFloat(d.c));
          };
        } else if (pair.ticker) {
          const res = await fetch(`/api/ohlcv/${pair.id}?tf=1h`);
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
  }, [pairId]);

  // ── Auto Signal: fetch OHLCV → signal engine → level calculator → fill form ──
  const runAutoSignal = async () => {
    if (!pair) return;
    setSignalLoading(true);
    setSignalError('');
    setSuggestion(null);

    try {
      let ohlcv: { time: number; open: number; high: number; low: number; close: number; volume: number }[] = [];

      if (pair.market === 'crypto' && pair.binanceSymbol) {
        const sym = pair.binanceSymbol.toUpperCase();
        const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=${sym}&interval=1h&limit=200`);
        const raw: number[][] = await res.json();
        ohlcv = raw.map(k => ({
          time: Math.floor(parseInt(String(k[0])) / 1000),
          open: parseFloat(String(k[1])),
          high: parseFloat(String(k[2])),
          low: parseFloat(String(k[3])),
          close: parseFloat(String(k[4])),
          volume: parseFloat(String(k[5])),
        }));
      } else {
        const res = await fetch(`/api/ohlcv/${pair.id}?tf=1h`);
        ohlcv = await res.json();
      }

      if (!Array.isArray(ohlcv) || ohlcv.length < 30) {
        setSignalError('Not enough data to generate a signal.');
        return;
      }

      const result = calculateSignal(ohlcv);
      if (result.signal === 'WAIT') {
        setSignalError(`No clear signal yet (confidence ${result.confidence}%). Market is ranging — wait for a better setup.`);
        return;
      }

      const levels = calculateLevels(ohlcv, result.signal, pair);
      if (!levels) {
        setSignalError('Could not calculate entry levels. Try again shortly.');
        return;
      }

      const sug: SignalSuggestion = {
        signal: result.signal,
        confidence: result.confidence,
        reasons: result.reasons,
        entry: levels.entry,
        sl: levels.sl,
        tp1: levels.tp1,
        tp2: levels.tp2,
        tp3: levels.tp3,
        rr: levels.rr,
        riskPips: levels.riskPips,
        selectedTp: 'tp2',
      };
      setSuggestion(sug);

      // Auto-fill the form fields
      const dp = pair.market === 'crypto' ? 2 : 5;
      setDirection(result.signal === 'BUY' ? 'LONG' : 'SHORT');
      setEntryPrice(levels.entry.toFixed(dp));
      setSl(levels.sl.toFixed(dp));
      setTp(levels.tp2.toFixed(dp));
      setStrategy(`Signal Engine (${result.confidence}% conf)`);
      setNote(result.reasons.slice(0, 2).join(' · '));

    } catch (e) {
      setSignalError('Failed to fetch data. Check your connection.');
    } finally {
      setSignalLoading(false);
    }
  };

  const applyTp = (tpKey: 'tp1' | 'tp2' | 'tp3') => {
    if (!suggestion) return;
    const dp = pair?.market === 'crypto' ? 2 : 5;
    setTp(suggestion[tpKey].toFixed(dp));
    setSuggestion({ ...suggestion, selectedTp: tpKey });
  };

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
    setSuggestion(null);
    setTimeout(() => setSubmitted(false), 2000);
    setEntryPrice(''); setSl(''); setTp(''); setNote(''); setStrategy('');
  };

  const useMarket = () => {
    if (livePrice) setEntryPrice(livePrice.toFixed(pair?.market === 'crypto' ? 2 : 5));
  };
  const autoSL = () => {
    if (!entry) return;
    const d = entry * 0.005;
    setSl(direction === 'LONG' ? (entry - d).toFixed(5) : (entry + d).toFixed(5));
  };
  const autoTP = () => {
    if (!entry || !slVal) return;
    const d = Math.abs(entry - slVal) * 2;
    setTp(direction === 'LONG' ? (entry + d).toFixed(5) : (entry - d).toFixed(5));
  };

  return (
    <div className="bg-slate-800/40 rounded-xl border border-white/5 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-white">Open Demo Trade</p>

        {/* AUTO SIGNAL BUTTON */}
        <button onClick={runAutoSignal} disabled={signalLoading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all bg-violet-500/15 hover:bg-violet-500/25 text-violet-400 border border-violet-500/25 disabled:opacity-50 disabled:cursor-not-allowed">
          {signalLoading ? (
            <>
              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Analysing…
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Auto Signal
            </>
          )}
        </button>
      </div>

      {/* Signal suggestion card */}
      {suggestion && (
        <div className={`rounded-xl border p-3 space-y-2 ${suggestion.signal === 'BUY' ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-bold px-2 py-0.5 rounded ${suggestion.signal === 'BUY' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
              {suggestion.signal === 'BUY' ? '▲ LONG' : '▼ SHORT'}
            </span>
            <span className="text-xs text-slate-400">{suggestion.confidence}% confidence</span>
            <span className="ml-auto text-xs text-slate-500">{pair?.name}</span>
          </div>

          {/* TP selector */}
          <div className="space-y-1">
            <p className="text-xs text-slate-500">Select Take Profit target:</p>
            <div className="flex gap-2">
              {(['tp1', 'tp2', 'tp3'] as const).map((tpKey, i) => {
                const tpLabels = ['TP1 (1.5R)', 'TP2 (2.5R)', 'TP3 (4R)'];
                const val = suggestion[tpKey];
                const dp = pair?.market === 'crypto' ? 2 : 5;
                const isSelected = suggestion.selectedTp === tpKey;
                return (
                  <button key={tpKey} onClick={() => applyTp(tpKey)}
                    className={`flex-1 py-1.5 px-2 rounded-lg text-xs transition-all border ${
                      isSelected
                        ? suggestion.signal === 'BUY'
                          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                          : 'bg-red-500/20 text-red-400 border-red-500/30'
                        : 'bg-slate-900/40 text-slate-400 border-white/8 hover:border-white/15'
                    }`}>
                    <div className="font-medium">{tpLabels[i]}</div>
                    <div className="font-mono mt-0.5">{val.toFixed(dp)}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Reasons */}
          <div className="flex flex-wrap gap-1">
            {suggestion.reasons.slice(0, 3).map((r, i) => (
              <span key={i} className="text-xs text-slate-400 bg-slate-800/60 px-2 py-0.5 rounded-full">{r}</span>
            ))}
          </div>

          <p className="text-xs text-slate-500">Entry, SL and TP filled below — adjust risk % and execute when ready.</p>
        </div>
      )}

      {/* Signal error */}
      {signalError && (
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3 text-xs text-amber-400">
          {signalError}
        </div>
      )}

      {/* Pair + direction */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Pair</label>
          <select value={pairId} onChange={e => { setPairId(e.target.value); setSuggestion(null); }}
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

      {/* Entry / SL / TP */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs text-slate-400">Entry Price</label>
            {livePrice && (
              <button onClick={useMarket} className="text-xs text-emerald-400 hover:text-emerald-300">
                Live {livePrice.toFixed(pair?.market === 'crypto' ? 2 : 5)}
              </button>
            )}
          </div>
          <input value={entryPrice} onChange={e => setEntryPrice(e.target.value)}
            placeholder={livePrice?.toFixed(pair?.market === 'crypto' ? 2 : 5) ?? '0.00'}
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
            <span className="text-slate-500">Risk $</span>
            <span className="text-white font-mono">${riskAmount.toFixed(2)}</span>
            <span className="text-slate-500">R:R</span>
            <span className={`font-mono ${rr >= 2 ? 'text-emerald-400' : rr >= 1 ? 'text-amber-400' : 'text-red-400'}`}>1:{rr.toFixed(1)}</span>
            <span className="text-slate-500">Units</span>
            <span className="text-white font-mono">{Math.round(units).toLocaleString()}</span>
            <span className="text-slate-500">SL pips</span>
            <span className="text-white font-mono">{slPips.toFixed(1)}</span>
          </div>
        </div>
      </div>

      {/* Strategy + emotion */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Strategy</label>
          <input value={strategy} onChange={e => setStrategy(e.target.value)} placeholder="e.g. Breakout, EMA cross"
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
        <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
          placeholder="Why are you taking this trade?"
          className="w-full bg-slate-900/60 border border-white/8 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-emerald-500/40 resize-none" />
      </div>

      {/* Execute */}
      <button onClick={handleSubmit} disabled={!canSubmit}
        className={`w-full py-2.5 rounded-lg text-sm font-bold transition-all ${
          submitted ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-500/30'
          : canSubmit
            ? direction === 'LONG'
              ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30'
              : 'bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30'
            : 'bg-slate-800 text-slate-600 border border-white/5 cursor-not-allowed'
        }`}>
        {submitted ? 'Trade Opened!' : `Execute ${direction} — ${pair?.name ?? ''}`}
      </button>
    </div>
  );
}
