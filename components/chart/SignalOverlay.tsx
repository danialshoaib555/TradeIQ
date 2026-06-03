'use client';
import Link from 'next/link';
import type { SignalResult } from '@/lib/signalEngine';
import type { TradeLevels } from '@/lib/levelCalculator';
import type { Strategy } from '@/lib/strategyMatcher';

interface Props {
  signal: SignalResult;
  levels: TradeLevels | null;
  strategy: Strategy | null;
  tradeType: 'spot' | 'long' | 'short';
  onTradeTypeChange: (t: 'spot' | 'long' | 'short') => void;
}

export default function SignalOverlay({ signal, levels, strategy, tradeType, onTradeTypeChange }: Props) {
  const sc = {
    BUY:  { bg: 'bg-emerald-500/10', border: 'border-emerald-500/25', text: 'text-emerald-400' },
    SELL: { bg: 'bg-red-500/10',     border: 'border-red-500/25',     text: 'text-red-400' },
    WAIT: { bg: 'bg-slate-500/10',   border: 'border-slate-500/20',   text: 'text-slate-400' },
  }[signal.signal];

  const conds = [
    { label: 'RSI Signal', met: signal.conditions.rsi },
    { label: 'EMA Cross',  met: signal.conditions.ema },
    { label: 'MACD Cross', met: signal.conditions.macd },
    { label: 'Volume',     met: signal.conditions.vol },
    { label: 'BB Level',   met: signal.conditions.bb },
  ];

  return (
    <div className="space-y-4">
      <div className={`${sc.bg} border ${sc.border} rounded-xl p-4`}>
        <div className="flex items-center justify-between mb-2">
          <span className={`text-2xl font-bold font-mono ${sc.text}`}>{signal.signal}</span>
          {signal.signal !== 'WAIT' && <span className="text-sm text-slate-400">{signal.confidence}%</span>}
        </div>
        {signal.signal !== 'WAIT' && (
          <div className="h-1.5 bg-black/20 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${signal.confidence >= 70 ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${signal.confidence}%` }} />
          </div>
        )}
      </div>

      <div>
        <p className="text-xs text-slate-500 mb-2">Trade Type</p>
        <div className="flex gap-1">
          {(['spot', 'long', 'short'] as const).map(t => (
            <button key={t} onClick={() => onTradeTypeChange(t)}
              className={`flex-1 py-2 rounded-lg text-xs font-medium capitalize cursor-pointer transition-all duration-150 ${tradeType === t ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-white/5 text-slate-500 border border-white/8 hover:bg-white/8'}`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {levels && signal.signal !== 'WAIT' ? (
        <div className="space-y-1.5">
          <p className="text-xs text-slate-500">Levels</p>
          {[
            { label: 'Entry', value: levels.entry, color: 'text-blue-300', bg: 'bg-blue-500/8' },
            { label: 'TP1 (1.5R)', value: levels.tp1, color: 'text-emerald-400', bg: 'bg-emerald-500/8' },
            { label: 'TP2 (2.5R)', value: levels.tp2, color: 'text-emerald-400', bg: 'bg-emerald-500/8' },
            { label: 'TP3 (4R)', value: levels.tp3, color: 'text-emerald-400', bg: 'bg-emerald-500/8' },
            { label: 'Stop Loss', value: levels.sl, color: 'text-red-400', bg: 'bg-red-500/8' },
          ].map(item => (
            <div key={item.label} className={`flex justify-between items-center px-3 py-2 ${item.bg} rounded-lg border border-white/5`}>
              <span className="text-xs text-slate-500">{item.label}</span>
              <span className={`font-mono text-sm font-semibold ${item.color}`}>{item.value}</span>
            </div>
          ))}
          <div className="flex justify-between items-center px-3 py-2 bg-white/3 rounded-lg border border-white/5">
            <span className="text-xs text-slate-500">R:R</span>
            <span className="font-mono text-sm font-semibold text-white">1:{levels.rr}</span>
          </div>
        </div>
      ) : signal.signal === 'WAIT' && (
        <div className="bg-white/3 rounded-xl p-4 border border-white/8">
          <p className="text-xs text-slate-400">{signal.reasons[0]}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-1.5">
        {[
          { label: 'RSI(14)', value: signal.indicators.rsi.toFixed(1), color: signal.indicators.rsi < 30 ? 'text-emerald-400' : signal.indicators.rsi > 70 ? 'text-red-400' : 'text-white' },
          { label: 'ADX(14)', value: signal.indicators.adx?.toFixed(1) ?? '—', color: signal.indicators.trending ? 'text-emerald-400' : 'text-slate-400' },
        ].map(item => (
          <div key={item.label} className="bg-white/3 rounded-lg p-2 border border-white/5">
            <div className="text-xs text-slate-500">{item.label}</div>
            <div className={`font-mono text-sm font-semibold ${item.color}`}>{item.value}</div>
          </div>
        ))}
      </div>

      <div className="space-y-1.5">
        <p className="text-xs text-slate-500">Conditions</p>
        {conds.map(c => (
          <div key={c.label} className="flex items-center gap-2">
            <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${c.met ? 'bg-emerald-500/20' : 'bg-white/5'}`}>
              {c.met
                ? <svg className="w-2.5 h-2.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                : <svg className="w-2.5 h-2.5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
              }
            </div>
            <span className={`text-xs ${c.met ? 'text-slate-300' : 'text-slate-600'}`}>{c.label}</span>
          </div>
        ))}
      </div>

      {signal.reasons.length > 0 && (
        <div className="bg-white/3 rounded-xl p-4 border border-white/8 space-y-1.5">
          <p className="text-xs font-medium text-slate-400">Why this signal</p>
          {signal.reasons.map((r, i) => <p key={i} className="text-xs text-slate-500">• {r}</p>)}
        </div>
      )}

      {strategy && (
        <div className="bg-blue-500/5 border border-blue-500/15 rounded-xl p-4">
          <p className="text-xs font-medium text-blue-400 mb-1">{strategy.name}</p>
          <p className="text-xs text-slate-400 mb-3 line-clamp-3">{strategy.explanation}</p>
          <Link href={`/learn/${strategy.key}`} className="text-xs text-blue-400 hover:text-blue-300 cursor-pointer transition-colors">
            Learn this strategy →
          </Link>
        </div>
      )}
    </div>
  );
}
