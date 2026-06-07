'use client';
import Link from 'next/link';
import type { SignalResult } from '@/lib/signalEngine';
import type { TradeLevels } from '@/lib/levelCalculator';
import type { Strategy } from '@/lib/strategyMatcher';
import type { BacktestResult, StrategyKey } from '@/lib/backtester';
import { STRATEGY_META } from '@/lib/backtester';

interface Props {
  signal: SignalResult;
  levels: TradeLevels | null;
  forcedLevels: TradeLevels | null;
  strategy: Strategy | null;
  tradeType: 'auto' | 'long' | 'short' | 'spot';
  onTradeTypeChange: (t: 'auto' | 'long' | 'short' | 'spot') => void;
  // Backtest data for selected strategy
  selectedStrategy?: StrategyKey;
  backtestResult?: BacktestResult | null;
}

export default function SignalOverlay({ signal, levels, forcedLevels, strategy, tradeType, onTradeTypeChange, selectedStrategy, backtestResult }: Props) {
  const effectiveDir = tradeType === 'long' ? 'BUY' : tradeType === 'short' ? 'SELL' : tradeType === 'spot' ? signal.signal : signal.signal;
  const activeLevels = (tradeType !== 'auto') ? forcedLevels : levels;

  const sc = {
    BUY:  { bg: 'bg-emerald-500/10', border: 'border-emerald-500/25', text: 'text-emerald-400', label: tradeType === 'long' ? 'LONG' : 'BUY',  icon: '↑' },
    SELL: { bg: 'bg-red-500/10',     border: 'border-red-500/25',     text: 'text-red-400',     label: tradeType === 'short' ? 'SHORT' : 'SELL', icon: '↓' },
    WAIT: { bg: 'bg-slate-500/10',   border: 'border-slate-500/20',   text: 'text-slate-400',   label: 'WAIT', icon: '—' },
  }[effectiveDir];

  const conds = [
    { label: 'RSI Signal', met: signal.conditions.rsi },
    { label: 'EMA Align',  met: signal.conditions.ema },
    { label: 'MACD',       met: signal.conditions.macd },
    { label: 'Volume',     met: signal.conditions.vol },
    { label: 'BB Level',   met: signal.conditions.bb },
  ];

  const tradeButtons: { key: 'auto' | 'long' | 'short' | 'spot'; label: string; active: string; inactive: string }[] = [
    { key: 'auto',  label: 'Auto',     active: 'bg-slate-500/20 text-slate-300 border-slate-500/40',     inactive: 'bg-white/5 text-slate-500 border-white/8' },
    { key: 'spot',  label: '◈ Spot',   active: 'bg-blue-500/20 text-blue-400 border-blue-500/40',         inactive: 'bg-white/5 text-slate-500 border-white/8 hover:text-blue-400' },
    { key: 'long',  label: '↑ Long',   active: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40', inactive: 'bg-white/5 text-slate-500 border-white/8 hover:text-emerald-400' },
    { key: 'short', label: '↓ Short',  active: 'bg-red-500/20 text-red-400 border-red-500/40',             inactive: 'bg-white/5 text-slate-500 border-white/8 hover:text-red-400' },
  ];

  const stratMeta = selectedStrategy ? STRATEGY_META[selectedStrategy] : null;
  const wr  = backtestResult?.winRate ?? 0;
  const exp = backtestResult?.expectancy ?? 0;
  const pf  = backtestResult?.profitFactor ?? 0;
  const tot = backtestResult?.totalTrades ?? 0;
  const hasBacktest = tot > 0;

  return (
    <div className="space-y-4">

      {/* ── Strategy Confidence Banner ── */}
      {stratMeta && (
        <div className="bg-white/3 border border-white/8 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: stratMeta.color }} />
              <span className="text-xs font-medium text-white truncate">{stratMeta.name}</span>
            </div>
            <span className={`text-xs px-1.5 py-0.5 rounded border capitalize ${
              stratMeta.difficulty === 'beginner' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' :
              stratMeta.difficulty === 'intermediate' ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' :
              'text-red-400 bg-red-500/10 border-red-500/20'
            }`}>{stratMeta.difficulty[0].toUpperCase()}</span>
          </div>

          {hasBacktest ? (
            <>
              {/* Win rate bar */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-slate-500">Backtest Win Rate</span>
                  <span className={`text-xs font-mono font-bold ${wr >= 60 ? 'text-emerald-400' : wr >= 50 ? 'text-amber-400' : 'text-red-400'}`}>{wr}%</span>
                </div>
                <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${wr}%`, backgroundColor: wr >= 60 ? '#22C55E' : wr >= 50 ? '#F59E0B' : '#EF4444' }} />
                </div>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-1.5">
                <div className="bg-white/4 rounded-lg p-1.5 text-center">
                  <div className={`text-sm font-mono font-bold ${exp >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {exp >= 0 ? '+' : ''}{exp}R
                  </div>
                  <div className="text-xs text-slate-600">Expect.</div>
                </div>
                <div className="bg-white/4 rounded-lg p-1.5 text-center">
                  <div className="text-sm font-mono font-bold text-white">{pf}×</div>
                  <div className="text-xs text-slate-600">Prof. F.</div>
                </div>
                <div className="bg-white/4 rounded-lg p-1.5 text-center">
                  <div className="text-sm font-mono font-bold text-white">{tot}</div>
                  <div className="text-xs text-slate-600">Trades</div>
                </div>
              </div>

              {/* W/L bar */}
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="text-emerald-600">{backtestResult!.wins}W</span>
                <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden flex">
                  {tot > 0 && <>
                    <div className="h-full bg-emerald-500" style={{ width: `${wr}%` }} />
                    <div className="h-full bg-red-500" style={{ width: `${100 - wr}%` }} />
                  </>}
                </div>
                <span className="text-red-600">{backtestResult!.losses}L</span>
              </div>
            </>
          ) : (
            <p className="text-xs text-slate-600">{stratMeta.shortDesc} · not enough candles for backtest</p>
          )}
        </div>
      )}

      {/* ── Direction Toggle ── */}
      <div>
        <p className="text-xs text-slate-500 mb-2">Trade Direction</p>
        <div className="flex gap-1">
          {tradeButtons.map(tb => (
            <button key={tb.key} onClick={() => onTradeTypeChange(tb.key)}
              className={`flex-1 py-2 rounded-lg text-xs font-medium cursor-pointer transition-all duration-150 border ${tradeType === tb.key ? tb.active : tb.inactive}`}>
              {tb.label}
            </button>
          ))}
        </div>
        {tradeType !== 'auto' && (
          <p className="text-xs text-slate-600 mt-1.5 text-center">
            {tradeType === 'long' ? 'Showing buy levels — overriding AI signal' : 'Showing sell levels — overriding AI signal'}
          </p>
        )}
      </div>

      {/* ── Signal banner ── */}
      <div className={`${sc.bg} border ${sc.border} rounded-xl p-4`}>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span className={`text-xl font-bold font-mono ${sc.text}`}>{sc.icon}</span>
            <span className={`text-xl font-bold font-mono ${sc.text}`}>{sc.label}</span>
          </div>
          {effectiveDir !== 'WAIT' && (
            <span className={`text-sm font-mono ${sc.text}`}>
              {tradeType !== 'auto' ? '—' : `${signal.confidence}%`}
            </span>
          )}
        </div>
        {tradeType === 'auto' && signal.signal !== 'WAIT' && (
          <div className="h-1.5 bg-black/20 rounded-full overflow-hidden mt-2">
            <div className={`h-full rounded-full ${signal.confidence >= 70 ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${signal.confidence}%` }} />
          </div>
        )}
        {tradeType === 'auto' && signal.signal === 'WAIT' && (
          <p className="text-xs text-slate-500 mt-1">Waiting for setup</p>
        )}
      </div>

      {/* ── Levels ── */}
      {activeLevels && effectiveDir !== 'WAIT' ? (
        <div className="space-y-1.5">
          <p className="text-xs text-slate-500">Trade Levels</p>
          {[
            { label: 'Entry',      value: activeLevels.entry, color: 'text-blue-300',    bg: 'bg-blue-500/8' },
            { label: 'TP1 (1.5R)', value: activeLevels.tp1,   color: 'text-emerald-400', bg: 'bg-emerald-500/8' },
            { label: 'TP2 (2.5R)', value: activeLevels.tp2,   color: 'text-emerald-400', bg: 'bg-emerald-500/8' },
            { label: 'TP3 (4R)',   value: activeLevels.tp3,   color: 'text-emerald-400', bg: 'bg-emerald-500/8' },
            { label: 'Stop Loss',  value: activeLevels.sl,    color: 'text-red-400',     bg: 'bg-red-500/8' },
          ].map(item => (
            <div key={item.label} className={`flex justify-between items-center px-3 py-2 ${item.bg} rounded-lg border border-white/5`}>
              <span className="text-xs text-slate-500">{item.label}</span>
              <span className={`font-mono text-sm font-semibold ${item.color}`}>{item.value}</span>
            </div>
          ))}
          <div className="flex justify-between items-center px-3 py-2 bg-white/3 rounded-lg border border-white/5">
            <span className="text-xs text-slate-500">R:R</span>
            <span className="font-mono text-sm font-semibold text-white">1:{activeLevels.rr}</span>
          </div>
        </div>
      ) : effectiveDir === 'WAIT' && (
        <div className="bg-white/3 rounded-xl p-4 border border-white/8">
          <p className="text-xs text-slate-400 font-medium mb-1">No active signal</p>
          <p className="text-xs text-slate-600">{signal.reasons[0]}</p>
          <p className="text-xs text-slate-600 mt-1">Use Long/Short to manually set direction.</p>
        </div>
      )}

      {/* ── Indicator readings ── */}
      <div className="grid grid-cols-2 gap-1.5">
        {[
          { label: 'RSI(14)', value: signal.indicators.rsi.toFixed(1), color: signal.indicators.rsi < 30 ? 'text-emerald-400' : signal.indicators.rsi > 70 ? 'text-red-400' : 'text-white' },
          { label: 'ADX(14)', value: signal.indicators.adx?.toFixed(1) ?? '—', color: signal.indicators.trending ? 'text-emerald-400' : 'text-slate-400' },
          { label: 'ATR',     value: signal.indicators.atr?.toFixed(4) ?? '—', color: 'text-white' },
          { label: 'MACD',    value: signal.indicators.macd?.toFixed(4) ?? '—', color: (signal.indicators.macd ?? 0) > 0 ? 'text-emerald-400' : 'text-red-400' },
        ].map(item => (
          <div key={item.label} className="bg-white/3 rounded-lg p-2 border border-white/5">
            <div className="text-xs text-slate-500">{item.label}</div>
            <div className={`font-mono text-sm font-semibold ${item.color}`}>{item.value}</div>
          </div>
        ))}
      </div>

      {/* ── AI Conditions ── */}
      <div className="space-y-1.5">
        <p className="text-xs text-slate-500">AI Conditions {tradeType === 'auto' ? `(${conds.filter(c=>c.met).length}/5 met)` : '(overridden)'}</p>
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

      {/* ── Reasons ── */}
      {tradeType === 'auto' && signal.reasons.length > 0 && (
        <div className="bg-white/3 rounded-xl p-3 border border-white/8 space-y-1">
          <p className="text-xs font-medium text-slate-400">Why this signal</p>
          {signal.reasons.map((r, i) => <p key={i} className="text-xs text-slate-500">• {r}</p>)}
        </div>
      )}

      {/* ── Strategy tip ── */}
      {strategy && (
        <div className="bg-blue-500/5 border border-blue-500/15 rounded-xl p-3">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-medium text-blue-400">AI Best Match</p>
            <span className="text-xs text-slate-500">{strategy.winRate}% win</span>
          </div>
          <p className="text-xs text-slate-400 mb-2 line-clamp-2">{strategy.explanation}</p>
          <Link href={`/learn/${strategy.key}`} className="text-xs text-blue-400 hover:text-blue-300 cursor-pointer transition-colors">
            Learn this strategy →
          </Link>
        </div>
      )}
    </div>
  );
}
