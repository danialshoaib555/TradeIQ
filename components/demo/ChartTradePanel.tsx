'use client';
import { useState } from 'react';
import { useDemoStore, type TradeDirection, type EmotionTag } from '@/store/useDemoStore';
import type { SignalResult } from '@/lib/signalEngine';
import type { TradeLevels } from '@/lib/levelCalculator';
import type { Pair } from '@/lib/pairConfig';

interface Props {
  pair: Pair;
  signal: SignalResult | null;
  levels: TradeLevels | null;
  livePrice: number | null;
}

type TpTarget = 'tp1' | 'tp2' | 'tp3';

const EMOTIONS = [
  { value: 'disciplined' as EmotionTag, label: 'Disciplined' },
  { value: 'confident'   as EmotionTag, label: 'Confident'   },
  { value: 'fearful'     as EmotionTag, label: 'Fearful'     },
  { value: 'greedy'      as EmotionTag, label: 'Greedy'      },
  { value: 'neutral'     as EmotionTag, label: 'Neutral'     },
];

export default function ChartTradePanel({ pair, signal, levels, livePrice }: Props) {
  const { balance, openTrade, trades } = useDemoStore();
  const openCount = trades.filter(t => t.status === 'OPEN').length;

  const [direction, setDirection] = useState<TradeDirection>(
    signal?.signal === 'SELL' ? 'SHORT' : 'LONG'
  );
  const [tpTarget, setTpTarget] = useState<TpTarget>('tp2');
  const [riskMode, setRiskMode] = useState<'pct' | 'usd'>('pct');
  const [riskPct, setRiskPct] = useState('2');
  const [riskUsd, setRiskUsd] = useState('');
  const [emotion, setEmotion] = useState<EmotionTag>('disciplined');
  const [submitted, setSubmitted] = useState(false);
  const [manualEntry, setManualEntry] = useState('');
  const [manualSl, setManualSl] = useState('');
  const [manualTp, setManualTp] = useState('');

  const pipSize = pair.pipSize;
  const dp = pair.market === 'crypto' ? 2 : 5;

  // Use signal levels if available, else manual
  const useSignal = !!levels && !manualEntry && !manualSl && !manualTp;
  const entryVal  = useSignal ? levels!.entry : parseFloat(manualEntry) || livePrice || 0;
  const slVal     = useSignal
    ? levels!.sl
    : parseFloat(manualSl) || 0;
  const tpVal     = useSignal
    ? (tpTarget === 'tp1' ? levels!.tp1 : tpTarget === 'tp2' ? levels!.tp2 : levels!.tp3)
    : parseFloat(manualTp) || 0;

  const riskAmount = riskMode === 'usd'
    ? Math.min(parseFloat(riskUsd) || 0, balance)
    : (parseFloat(riskPct) / 100) * balance;
  const slPips  = slVal && entryVal ? Math.abs(entryVal - slVal) / pipSize : 0;
  const tpPips  = tpVal && entryVal ? Math.abs(tpVal - entryVal) / pipSize : 0;
  const rr      = slPips > 0 && tpPips > 0 ? tpPips / slPips : 0;
  const units   = slPips > 0 ? riskAmount / (slPips * pipSize) : 0;
  const lotSize = pair.market === 'crypto' ? units : units / 100000;

  const canExecute = entryVal > 0 && slVal > 0 && tpVal > 0 && parseFloat(riskPct) > 0;

  const signalDir: TradeDirection = signal?.signal === 'SELL' ? 'SHORT' : 'LONG';
  const signalColor = signalDir === 'LONG' ? 'text-emerald-400' : 'text-red-400';
  const confidence  = signal?.confidence ?? 0;

  const execute = () => {
    if (!canExecute) return;
    const strategyStr = signal
      ? `Signal Engine (${signal.confidence}% · ${signal.signal})`
      : 'Manual';
    openTrade({
      pairId:     pair.id,
      pairName:   pair.name,
      direction,
      entryPrice: entryVal,
      sl:         slVal,
      tp:         tpVal,
      lotSize:    Math.round(lotSize * 100) / 100,
      units:      Math.round(units),
      riskAmount: Math.round(riskAmount * 100) / 100,
      riskReward: Math.round(rr * 10) / 10,
      pipSize,
      market:     pair.market,
      emotion,
      strategy:   strategyStr,
      note:       signal ? signal.reasons.slice(0, 2).join(' · ') : undefined,
    });
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 2500);
    setManualEntry(''); setManualSl(''); setManualTp('');
  };

  return (
    <div className="space-y-3 text-sm">

      {/* Account mini-bar */}
      <div className="flex items-center justify-between bg-slate-800/60 rounded-lg px-2.5 py-2 border border-white/5">
        <div>
          <p className="text-xs text-slate-500">Balance</p>
          <p className="text-xs font-mono text-white font-bold">${balance.toLocaleString('en', { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500">Open</p>
          <p className="text-xs font-mono text-white">{openCount} pos</p>
        </div>
      </div>

      {/* Signal badge */}
      {signal ? (
        <div className={`rounded-lg border p-2.5 ${
          signal.signal === 'WAIT'
            ? 'bg-slate-800/40 border-white/8'
            : signal.signal === 'BUY'
              ? 'bg-emerald-500/5 border-emerald-500/20'
              : 'bg-red-500/5 border-red-500/20'
        }`}>
          <div className="flex items-center justify-between mb-1">
            <span className={`text-xs font-bold ${
              signal.signal === 'WAIT' ? 'text-slate-400'
              : signal.signal === 'BUY' ? 'text-emerald-400' : 'text-red-400'
            }`}>
              {signal.signal === 'BUY' ? '▲ BUY SIGNAL' : signal.signal === 'SELL' ? '▼ SELL SIGNAL' : '— WAIT'}
            </span>
            <span className={`text-xs font-mono ${confidence >= 60 ? 'text-emerald-400' : confidence >= 40 ? 'text-amber-400' : 'text-slate-500'}`}>
              {confidence}%
            </span>
          </div>
          {signal.reasons.slice(0, 2).map((r, i) => (
            <p key={i} className="text-xs text-slate-500 leading-relaxed">{r}</p>
          ))}
        </div>
      ) : (
        <div className="bg-slate-800/40 rounded-lg p-2.5 border border-white/8 text-center">
          <div className="w-4 h-4 border-2 border-slate-600 border-t-emerald-400 rounded-full animate-spin mx-auto mb-1" />
          <p className="text-xs text-slate-500">Analysing…</p>
        </div>
      )}

      {/* Direction */}
      <div>
        <p className="text-xs text-slate-500 mb-1.5">Direction</p>
        <div className="flex gap-1.5">
          <button onClick={() => setDirection('LONG')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all border ${
              direction === 'LONG'
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                : 'bg-slate-900/40 text-slate-500 border-white/8 hover:text-slate-300'
            }`}>
            ▲ LONG
          </button>
          <button onClick={() => setDirection('SHORT')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all border ${
              direction === 'SHORT'
                ? 'bg-red-500/20 text-red-400 border-red-500/30'
                : 'bg-slate-900/40 text-slate-500 border-white/8 hover:text-slate-300'
            }`}>
            ▼ SHORT
          </button>
        </div>
        {signal && signal.signal !== 'WAIT' && direction !== signalDir && (
          <p className="text-xs text-amber-400 mt-1">⚠ Signal suggests {signalDir} — trading against signal</p>
        )}
      </div>

      {/* Levels — from signal or manual */}
      {useSignal && levels ? (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-1.5 text-xs">
            <div className="bg-slate-900/40 rounded-lg p-2 border border-white/5">
              <p className="text-slate-500 mb-0.5">Entry</p>
              <p className="font-mono text-white font-medium">{levels.entry.toFixed(dp)}</p>
            </div>
            <div className="bg-slate-900/40 rounded-lg p-2 border border-red-500/15">
              <p className="text-slate-500 mb-0.5">Stop Loss</p>
              <p className="font-mono text-red-400 font-medium">{levels.sl.toFixed(dp)}</p>
            </div>
          </div>

          {/* TP selector */}
          <div>
            <p className="text-xs text-slate-500 mb-1.5">Take Profit</p>
            <div className="flex gap-1">
              {([['tp1', '1.5R'], ['tp2', '2.5R'], ['tp3', '4R']] as [TpTarget, string][]).map(([key, label]) => (
                <button key={key} onClick={() => setTpTarget(key)}
                  className={`flex-1 py-1.5 rounded-lg text-xs transition-all border ${
                    tpTarget === key
                      ? direction === 'LONG'
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                        : 'bg-red-500/20 text-red-400 border-red-500/30'
                      : 'bg-slate-900/40 text-slate-500 border-white/8 hover:text-slate-300'
                  }`}>
                  <div className="font-medium">{label}</div>
                  <div className="font-mono mt-0.5 text-xs">{levels[key].toFixed(dp)}</div>
                </button>
              ))}
            </div>
          </div>

          <button onClick={() => { setManualEntry(levels.entry.toFixed(dp)); setManualSl(levels.sl.toFixed(dp)); setManualTp(tpVal.toFixed(dp)); }}
            className="text-xs text-slate-600 hover:text-slate-400 transition-colors">
            Edit manually →
          </button>
        </div>
      ) : (
        /* Manual inputs */
        <div className="space-y-1.5">
          <div className="grid grid-cols-3 gap-1.5">
            <div>
              <p className="text-xs text-slate-500 mb-1">Entry</p>
              <input value={manualEntry} onChange={e => setManualEntry(e.target.value)}
                placeholder={livePrice?.toFixed(dp) ?? '0'}
                className="w-full bg-slate-900/60 border border-white/8 rounded-lg px-2 py-1.5 text-xs text-white font-mono outline-none focus:border-emerald-500/30" />
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">SL</p>
              <input value={manualSl} onChange={e => setManualSl(e.target.value)} placeholder="0"
                className="w-full bg-slate-900/60 border border-white/8 rounded-lg px-2 py-1.5 text-xs text-white font-mono outline-none focus:border-red-500/30" />
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">TP</p>
              <input value={manualTp} onChange={e => setManualTp(e.target.value)} placeholder="0"
                className="w-full bg-slate-900/60 border border-white/8 rounded-lg px-2 py-1.5 text-xs text-white font-mono outline-none focus:border-emerald-500/30" />
            </div>
          </div>
          {levels && (
            <button onClick={() => { setManualEntry(''); setManualSl(''); setManualTp(''); }}
              className="text-xs text-emerald-500 hover:text-emerald-400 transition-colors">
              ← Use signal levels
            </button>
          )}
        </div>
      )}

      {/* Risk input */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-xs text-slate-500">Amount to risk</p>
          {/* Mode toggle */}
          <div className="flex rounded-lg overflow-hidden border border-white/8 text-xs">
            <button onClick={() => setRiskMode('usd')}
              className={`px-2 py-0.5 transition-all ${riskMode === 'usd' ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-500 hover:text-slate-300'}`}>
              $
            </button>
            <button onClick={() => setRiskMode('pct')}
              className={`px-2 py-0.5 transition-all ${riskMode === 'pct' ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-500 hover:text-slate-300'}`}>
              %
            </button>
          </div>
        </div>

        {riskMode === 'usd' ? (
          <div className="space-y-1.5">
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">$</span>
              <input
                value={riskUsd}
                onChange={e => setRiskUsd(e.target.value)}
                type="number" min="1" max={balance} step="10"
                placeholder={`e.g. ${Math.round(balance * 0.02)}`}
                className="w-full bg-slate-900/60 border border-white/8 rounded-lg pl-6 pr-3 py-1.5 text-xs text-white font-mono outline-none focus:border-emerald-500/30"
              />
            </div>
            {/* Quick $ presets */}
            <div className="flex gap-1">
              {[50, 100, 200, 500].filter(v => v <= balance).map(v => (
                <button key={v} onClick={() => setRiskUsd(String(v))}
                  className={`flex-1 py-1 rounded text-xs transition-all border ${
                    parseFloat(riskUsd) === v
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/25'
                      : 'bg-slate-900/40 text-slate-500 hover:text-slate-300 border-white/5'
                  }`}>
                  ${v}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-600">
              = {riskUsd && balance ? ((parseFloat(riskUsd) / balance) * 100).toFixed(1) : '0.0'}% of ${balance.toFixed(0)} balance
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            <div className="relative">
              <input value={riskPct} onChange={e => setRiskPct(e.target.value)}
                type="number" min="0.1" max="100" step="0.5"
                className="w-full bg-slate-900/60 border border-white/8 rounded-lg px-3 pr-6 py-1.5 text-xs text-white font-mono outline-none focus:border-emerald-500/30" />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">%</span>
            </div>
            {/* Quick % presets */}
            <div className="flex gap-1">
              {['1', '2', '5', '10'].map(v => (
                <button key={v} onClick={() => setRiskPct(v)}
                  className={`flex-1 py-1 rounded text-xs transition-all border ${
                    riskPct === v
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/25'
                      : 'bg-slate-900/40 text-slate-500 hover:text-slate-300 border-white/5'
                  }`}>
                  {v}%
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-600">
              = ${riskAmount.toFixed(2)} of ${balance.toFixed(0)} balance
            </p>
          </div>
        )}
      </div>

      {/* R:R preview */}
      {canExecute && (
        <div className="flex items-center gap-3 bg-slate-900/40 rounded-lg px-3 py-2 border border-white/5 text-xs">
          <div>
            <span className="text-slate-500">R:R </span>
            <span className={`font-mono font-bold ${rr >= 2 ? 'text-emerald-400' : rr >= 1 ? 'text-amber-400' : 'text-red-400'}`}>1:{rr.toFixed(1)}</span>
          </div>
          <div className="h-3 w-px bg-white/10" />
          <div>
            <span className="text-slate-500">Size </span>
            <span className="font-mono text-white">{Math.round(units).toLocaleString()}</span>
          </div>
          <div className="h-3 w-px bg-white/10" />
          <div>
            <span className="text-slate-500">Pips </span>
            <span className="font-mono text-white">{slPips.toFixed(1)}</span>
          </div>
        </div>
      )}

      {/* Emotion */}
      <div>
        <p className="text-xs text-slate-500 mb-1">Emotion</p>
        <select value={emotion} onChange={e => setEmotion(e.target.value as EmotionTag)}
          className="w-full bg-slate-900/60 border border-white/8 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-emerald-500/30">
          {EMOTIONS.map(em => <option key={em.value} value={em.value}>{em.label}</option>)}
        </select>
      </div>

      {/* Execute */}
      <button onClick={execute} disabled={!canExecute}
        className={`w-full py-2.5 rounded-xl text-sm font-bold transition-all ${
          submitted
            ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-500/30'
            : canExecute
              ? direction === 'LONG'
                ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30'
                : 'bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30'
              : 'bg-slate-800/60 text-slate-600 border border-white/5 cursor-not-allowed'
        }`}>
        {submitted
          ? '✓ Trade Opened!'
          : canExecute
            ? `Execute ${direction} — ${pair.name}`
            : 'Set entry, SL & TP'}
      </button>

      {submitted && (
        <p className="text-xs text-center text-slate-500">View in Demo Trading → Open Positions</p>
      )}
    </div>
  );
}
