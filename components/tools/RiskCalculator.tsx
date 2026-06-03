'use client';
import { useState, useMemo } from 'react';
import { calculateFutures } from '@/lib/futuresCalculator';

export default function RiskCalculator() {
  const [balance, setBalance] = useState(10000);
  const [riskPct, setRiskPct] = useState(2);
  const [entry, setEntry] = useState(1.1000);
  const [sl, setSl] = useState(1.0950);
  const [leverage, setLeverage] = useState(1);

  const result = useMemo(() => {
    if (!entry || !sl || entry === sl) return null;
    const tp3 = entry + (entry - sl) * 4;
    return calculateFutures(entry, sl, tp3, leverage, balance, riskPct / 100);
  }, [balance, riskPct, entry, sl, leverage]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="bg-white/2 border border-white/8 rounded-2xl p-6">
        <h2 className="font-semibold text-white mb-5">Trade Parameters</h2>
        <div className="space-y-4">
          {[
            { label: 'Account Balance ($)', value: balance, set: setBalance, step: 100 },
            { label: 'Entry Price', value: entry, set: setEntry, step: 0.0001 },
            { label: 'Stop Loss Price', value: sl, set: setSl, step: 0.0001 },
          ].map(f => (
            <div key={f.label}>
              <label className="block text-xs text-slate-500 mb-1">{f.label}</label>
              <input type="number" value={f.value} step={f.step} onChange={e => f.set(parseFloat(e.target.value) || 0)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-emerald-500/50 transition-all"
              />
            </div>
          ))}

          <div>
            <label className="block text-xs text-slate-500 mb-1">
              Risk: <span className="text-emerald-400 font-mono">{riskPct}%</span> = <span className="text-emerald-400 font-mono">${(balance * riskPct / 100).toFixed(2)}</span>
            </label>
            <input type="range" min={0.5} max={5} step={0.5} value={riskPct} onChange={e => setRiskPct(parseFloat(e.target.value))} className="w-full accent-emerald-500" />
            <div className="flex justify-between text-xs text-slate-600 mt-1"><span>0.5%</span><span className="text-emerald-500">2% rule</span><span>5%</span></div>
          </div>
          {riskPct > 2 && <div className="p-3 bg-amber-500/8 border border-amber-500/20 rounded-xl text-xs text-amber-400">Risking more than 2% is not recommended for beginners.</div>}

          <div>
            <label className="block text-xs text-slate-500 mb-2">Leverage: <span className="text-white font-mono">{leverage}x</span></label>
            <div className="flex gap-2">
              {[1, 3, 5, 10, 20].map(l => (
                <button key={l} onClick={() => setLeverage(l)}
                  className={`flex-1 py-2 rounded-lg text-sm font-mono cursor-pointer transition-all duration-150 ${leverage === l ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-white/5 text-slate-400 border border-white/8 hover:bg-white/8'}`}>
                  {l}x
                </button>
              ))}
            </div>
            {leverage > 10 && <p className="text-xs text-red-400 mt-2">High leverage significantly increases liquidation risk.</p>}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {result ? (
          <>
            <div className="bg-white/2 border border-white/8 rounded-2xl p-6">
              <h2 className="font-semibold text-white mb-4">Trade Summary</h2>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Position Size', value: result.positionSize.toLocaleString(), color: 'text-white' },
                  { label: 'Risk Amount', value: `$${result.riskAmount.toFixed(2)}`, color: 'text-red-400' },
                  { label: 'Potential Profit (TP3)', value: `$${result.potentialProfit.toFixed(2)}`, color: 'text-emerald-400' },
                  { label: 'R:R Ratio', value: `1:${result.rrRatio}`, color: result.rrRatio >= 2 ? 'text-emerald-400' : 'text-amber-400' },
                ].map(item => (
                  <div key={item.label} className="bg-white/3 rounded-xl p-3 border border-white/5">
                    <div className="text-xs text-slate-500 mb-1">{item.label}</div>
                    <div className={`font-mono font-bold ${item.color}`}>{item.value}</div>
                  </div>
                ))}
              </div>
            </div>
            {leverage > 1 && (
              <div className="bg-white/2 border border-white/8 rounded-2xl p-6">
                <h2 className="font-semibold text-white mb-4">Futures Details</h2>
                <div className="space-y-2">
                  {[
                    { label: 'Notional Value', value: `$${result.notionalValue.toLocaleString()}` },
                    { label: 'Margin Required', value: `$${result.marginRequired.toFixed(2)}` },
                    { label: 'Liquidation (Long)', value: String(result.liquidationLong) },
                    { label: 'Liquidation (Short)', value: String(result.liquidationShort) },
                  ].map(item => (
                    <div key={item.label} className="flex justify-between items-center py-1.5 border-b border-white/3 last:border-0">
                      <span className="text-xs text-slate-500">{item.label}</span>
                      <span className="font-mono text-sm text-white">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="bg-white/2 border border-white/8 rounded-2xl p-6 flex items-center justify-center text-slate-500 h-48">
            Enter valid entry and stop loss prices
          </div>
        )}
        <div className="bg-emerald-500/5 border border-emerald-500/15 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-emerald-400 mb-3">Beginner Rules</h3>
          <ul className="space-y-2 text-xs text-slate-400">
            {['Never risk more than 2% of your account per trade','Always set a stop loss before entering','Minimum 1:2 Risk:Reward ratio','Avoid leverage above 10x until experienced','Never trade during high-impact news events'].map((r, i) => (
              <li key={i} className="flex items-start gap-2">
                <svg className="w-3.5 h-3.5 text-emerald-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                {r}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
