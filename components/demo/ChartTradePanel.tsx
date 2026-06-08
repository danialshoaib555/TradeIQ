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
  const [emotion, setEmotion] = useState<EmotionTag>('disciplined');
  const [submitted, setSubmitted] = useState(false);
  const [manualEntry, setManualEntry] = useState('');
  const [manualSl, setManualSl]   = useState('');
  const [manualTp, setManualTp]   = useState('');

  // Two independent fields
  const [tradeBalance, setTradeBalance] = useState(''); // how much of balance to deploy
  const [riskAmount,   setRiskAmount]   = useState(''); // max loss if SL hit

  const pipSize = pair.pipSize;
  const dp = pair.market === 'crypto' ? 2 : 5;

  // Levels — signal or manual
  const useSignal = !!levels && !manualEntry && !manualSl && !manualTp;
  const entryVal  = useSignal ? levels!.entry : parseFloat(manualEntry) || livePrice || 0;
  const slVal     = useSignal ? levels!.sl     : parseFloat(manualSl) || 0;
  const tpVal     = useSignal
    ? (tpTarget === 'tp1' ? levels!.tp1 : tpTarget === 'tp2' ? levels!.tp2 : levels!.tp3)
    : parseFloat(manualTp) || 0;

  const slPips = slVal && entryVal ? Math.abs(entryVal - slVal) / pipSize : 0;
  const tpPips = tpVal && entryVal ? Math.abs(tpVal - entryVal) / pipSize : 0;
  const rr     = slPips > 0 && tpPips > 0 ? tpPips / slPips : 0;

  // Trade balance — what the user is deploying for this trade
  const allocParsed = Math.min(parseFloat(tradeBalance) || 0, balance);

  // Risk amount — portion of the TRADE BALANCE they're willing to lose (not total account)
  const riskParsed = Math.min(parseFloat(riskAmount) || 0, allocParsed);

  // Position size from allocation
  const units   = allocParsed > 0 && entryVal > 0 ? allocParsed / entryVal : 0;
  const lotSize = pair.market === 'crypto' ? units : units / 100000;

  // SL-based max loss from position size
  const slLoss = units > 0 && slPips > 0 ? units * slPips * pipSize : 0;

  // Effective risk = user's risk input (capped at slLoss), or slLoss if not set
  const effectiveRisk = riskParsed > 0 ? Math.min(riskParsed, slLoss) : slLoss;

  const canExecute = entryVal > 0 && slVal > 0 && tpVal > 0 && allocParsed > 0;

  const signalDir: TradeDirection = signal?.signal === 'SELL' ? 'SHORT' : 'LONG';
  const confidence = signal?.confidence ?? 0;

  const execute = () => {
    if (!canExecute) return;
    openTrade({
      pairId:     pair.id,
      pairName:   pair.name,
      direction,
      entryPrice: entryVal,
      sl:         slVal,
      tp:         tpVal,
      lotSize:    Math.round(lotSize * 100) / 100,
      units:      Math.round(units),
      riskAmount: Math.round(effectiveRisk * 100) / 100,
      riskReward: Math.round(rr * 10) / 10,
      pipSize,
      market:     pair.market,
      emotion,
      strategy:   signal ? `Signal Engine (${signal.confidence}% · ${signal.signal})` : 'Manual',
      note:       signal ? signal.reasons.slice(0, 2).join(' · ') : undefined,
    });
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 2500);
    setManualEntry(''); setManualSl(''); setManualTp('');
    setTradeBalance(''); setRiskAmount('');
  };

  return (
    <div className="space-y-3 text-sm">

      {/* Account bar */}
      <div className="flex items-center justify-between bg-slate-800/60 rounded-lg px-2.5 py-2 border border-white/5">
        <div>
          <p className="text-xs text-slate-500">Total Balance</p>
          <p className="text-xs font-mono text-white font-bold">${balance.toLocaleString('en', { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500">Open positions</p>
          <p className="text-xs font-mono text-white">{openCount}</p>
        </div>
      </div>

      {/* Signal badge */}
      {signal ? (
        <div className={`rounded-lg border p-2.5 ${
          signal.signal === 'WAIT' ? 'bg-slate-800/40 border-white/8'
          : signal.signal === 'BUY' ? 'bg-emerald-500/5 border-emerald-500/20'
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
              direction === 'LONG' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-slate-900/40 text-slate-500 border-white/8 hover:text-slate-300'
            }`}>▲ LONG</button>
          <button onClick={() => setDirection('SHORT')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all border ${
              direction === 'SHORT' ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'bg-slate-900/40 text-slate-500 border-white/8 hover:text-slate-300'
            }`}>▼ SHORT</button>
        </div>
        {signal && signal.signal !== 'WAIT' && direction !== signalDir && (
          <p className="text-xs text-amber-400 mt-1">⚠ Signal suggests {signalDir}</p>
        )}
      </div>

      {/* Entry / SL / TP */}
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
          <div>
            <p className="text-xs text-slate-500 mb-1.5">Take Profit</p>
            <div className="flex gap-1">
              {([['tp1', '1.5R'], ['tp2', '2.5R'], ['tp3', '4R']] as [TpTarget, string][]).map(([key, label]) => (
                <button key={key} onClick={() => setTpTarget(key)}
                  className={`flex-1 py-1.5 rounded-lg text-xs transition-all border ${
                    tpTarget === key
                      ? direction === 'LONG' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30'
                      : 'bg-slate-900/40 text-slate-500 border-white/8 hover:text-slate-300'
                  }`}>
                  <div className="font-medium">{label}</div>
                  <div className="font-mono mt-0.5 text-xs">{levels[key].toFixed(dp)}</div>
                </button>
              ))}
            </div>
          </div>
          <button onClick={() => { setManualEntry(levels.entry.toFixed(dp)); setManualSl(levels.sl.toFixed(dp)); setManualTp(tpVal.toFixed(dp)); }}
            className="text-xs text-slate-600 hover:text-slate-400 transition-colors">Edit manually →</button>
        </div>
      ) : (
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
              className="text-xs text-emerald-500 hover:text-emerald-400 transition-colors">← Use signal levels</button>
          )}
        </div>
      )}

      {/* ── Two separate size fields ── */}
      <div className="space-y-2.5">

        {/* Field 1: Trade Balance (how much to deploy) */}
        <div className="bg-slate-900/50 rounded-xl border border-white/8 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-white">Trade Balance</p>
            <p className="text-xs text-slate-500">How much to put in</p>
          </div>
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-mono">$</span>
            <input value={tradeBalance} onChange={e => setTradeBalance(e.target.value)}
              type="number" min="1" max={balance} step="100"
              placeholder={`Available: $${balance.toFixed(0)}`}
              className="w-full bg-slate-900/60 border border-white/8 rounded-lg pl-6 pr-3 py-2 text-xs text-white font-mono outline-none focus:border-sky-500/40" />
          </div>
          <div className="flex gap-1">
            {(['25%', '50%', '75%', 'All'] as const).map((label) => {
              const pct = label === 'All' ? 1 : parseInt(label) / 100;
              const val = Math.floor(balance * pct);
              return (
                <button key={label} onClick={() => setTradeBalance(String(val))}
                  className={`flex-1 py-1 rounded text-xs transition-all border ${
                    parseFloat(tradeBalance) === val
                      ? 'bg-sky-500/20 text-sky-400 border-sky-500/25'
                      : 'bg-slate-800/60 text-slate-500 hover:text-slate-300 border-white/5'
                  }`}>
                  {label}
                </button>
              );
            })}
          </div>
          {allocParsed > 0 && (
            <p className="text-xs text-slate-500">
              {((allocParsed / balance) * 100).toFixed(0)}% of balance · {Math.round(units).toLocaleString()} units
            </p>
          )}
        </div>

        {/* Field 2: Risk Amount (% of trade balance) */}
        <div className={`bg-slate-900/50 rounded-xl border p-3 space-y-2 ${allocParsed > 0 ? 'border-white/8' : 'border-white/4 opacity-50'}`}>
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-white">Risk Amount</p>
            <p className="text-xs text-slate-500">
              {allocParsed > 0 ? `of $${allocParsed.toFixed(0)} trade balance` : 'set trade balance first'}
            </p>
          </div>
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-mono">$</span>
            <input value={riskAmount} onChange={e => setRiskAmount(e.target.value)}
              type="number" min="1" max={allocParsed} step="10"
              disabled={allocParsed === 0}
              placeholder={allocParsed > 0 ? (slLoss > 0 ? `SL-based: $${slLoss.toFixed(0)}` : `max $${allocParsed.toFixed(0)}`) : '—'}
              className="w-full bg-slate-900/60 border border-white/8 rounded-lg pl-6 pr-3 py-2 text-xs text-white font-mono outline-none focus:border-amber-500/40 disabled:cursor-not-allowed" />
          </div>
          {/* Quick % of trade balance */}
          <div className="flex gap-1">
            {(['10%', '25%', '50%', '100%'] as const).map(label => {
              const pct = parseInt(label) / 100;
              const val = Math.floor(allocParsed * pct);
              return (
                <button key={label} onClick={() => setRiskAmount(String(val))}
                  disabled={allocParsed === 0}
                  className={`flex-1 py-1 rounded text-xs transition-all border ${
                    parseFloat(riskAmount) === val && val > 0
                      ? 'bg-amber-500/20 text-amber-400 border-amber-500/25'
                      : 'bg-slate-800/60 text-slate-500 hover:text-slate-300 border-white/5 disabled:cursor-not-allowed'
                  }`}>
                  {label}
                </button>
              );
            })}
          </div>
          {allocParsed > 0 && (
            <p className={`text-xs ${riskParsed > slLoss && slLoss > 0 ? 'text-amber-400' : 'text-slate-500'}`}>
              {riskParsed > 0
                ? riskParsed > slLoss && slLoss > 0
                  ? `Capped at SL: $${slLoss.toFixed(2)}`
                  : `${((riskParsed / allocParsed) * 100).toFixed(0)}% of your $${allocParsed.toFixed(0)} trade balance`
                : slLoss > 0
                  ? `SL will cost $${slLoss.toFixed(2)} (${((slLoss / allocParsed) * 100).toFixed(0)}% of trade balance)`
                  : 'Enter entry & SL to see max loss'
              }
            </p>
          )}
        </div>
      </div>

      {/* Trade summary */}
      {canExecute && (
        <div className="grid grid-cols-3 gap-1.5 text-xs">
          <div className="bg-slate-900/40 rounded-lg p-2 border border-white/5 text-center">
            <p className="text-slate-500">R:R</p>
            <p className={`font-mono font-bold ${rr >= 2 ? 'text-emerald-400' : rr >= 1 ? 'text-amber-400' : 'text-red-400'}`}>1:{rr.toFixed(1)}</p>
          </div>
          <div className="bg-slate-900/40 rounded-lg p-2 border border-white/5 text-center">
            <p className="text-slate-500">At risk</p>
            <p className="font-mono font-bold text-amber-400">${effectiveRisk.toFixed(0)}</p>
            {allocParsed > 0 && <p className="text-xs text-slate-600">{((effectiveRisk / allocParsed) * 100).toFixed(0)}% of trade</p>}
          </div>
          <div className="bg-slate-900/40 rounded-lg p-2 border border-white/5 text-center">
            <p className="text-slate-500">SL pips</p>
            <p className="font-mono font-bold text-white">{slPips.toFixed(1)}</p>
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
          submitted ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-500/30'
          : canExecute
            ? direction === 'LONG'
              ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30'
              : 'bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30'
            : 'bg-slate-800/60 text-slate-600 border border-white/5 cursor-not-allowed'
        }`}>
        {submitted ? '✓ Trade Opened!'
          : canExecute ? `Execute ${direction} — ${pair.name}`
          : 'Set Trade Balance to continue'}
      </button>

      {submitted && (
        <p className="text-xs text-center text-slate-500">Check Demo Trading → Open Positions</p>
      )}
    </div>
  );
}
