'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

const TOUR_KEY = 'tradeiq-tour-done-v1';

interface TourStep {
  title: string;
  body: string;
  tip?: string;
  link?: { href: string; label: string };
  icon: string; // svg path
}

const STEPS: TourStep[] = [
  {
    title: 'Welcome to TradeIQ',
    body: 'A professional-grade trading dashboard built for new traders. Live signals across 105 pairs — crypto, forex, stocks, indices and commodities — with zero paid APIs.',
    tip: 'Everything here is free and runs on real market data.',
    icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6',
  },
  {
    title: 'Live Signals',
    body: 'The Signal Feed scans every pair with RSI, EMA, MACD, Bollinger Bands and ADX. Each signal shows BUY / SELL / WAIT with a confidence score — higher confidence means more indicators agree.',
    tip: 'Filter by market and sort by confidence to find the best setups fast.',
    icon: 'M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z',
  },
  {
    title: 'Real-Time Charts + Tools',
    body: 'Open any pair to get a live streaming chart with 13 timeframes and 5 chart styles. Use the drawing toolbar (top-right of the chart) for horizontal lines, auto-Fibonacci and auto support/resistance.',
    tip: 'Entry, stop loss and 3 take-profit targets are drawn on the chart automatically.',
    link: { href: '/chart/btcusdt', label: 'Open BTC chart' },
    icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  },
  {
    title: '25 Trading Strategies',
    body: 'From EMA crosses and breakouts to institutional concepts like order blocks and liquidity grabs. Every strategy is backtested live on the chart data — you see its real win rate before trusting it.',
    tip: 'The chart auto-selects the strategy with the best expectancy for the current market.',
    link: { href: '/strategies', label: 'Browse strategies' },
    icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10',
  },
  {
    title: 'Demo Trading — $10,000',
    body: 'Practice with a virtual account before risking real money. Open trades straight from the chart\'s Trade tab — every setup gets graded A+ to F like a prop-firm risk desk would.',
    tip: 'The daily loss guard stops you at −5%, exactly like funded trader programs.',
    link: { href: '/demo', label: 'Start demo trading' },
    icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  },
  {
    title: 'Whales, Alerts & Discipline',
    body: 'The Whale Tracker streams $500K+ moves across 5 exchanges and the Bitcoin blockchain. Set price alerts on any pair and get browser notifications the second they trigger.',
    tip: 'Star your favorite pairs in the sidebar to pin them to the top.',
    icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9',
  },
];

export default function GuidedTour() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    try {
      if (!localStorage.getItem(TOUR_KEY)) {
        const t = setTimeout(() => setOpen(true), 800);
        return () => clearTimeout(t);
      }
    } catch {}
  }, []);

  const finish = () => {
    try { localStorage.setItem(TOUR_KEY, '1'); } catch {}
    setOpen(false);
    setStep(0);
  };

  const s = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <>
      {/* Floating help button — always available */}
      <button onClick={() => { setStep(0); setOpen(true); }}
        aria-label="Open guided tour"
        title="How to use TradeIQ"
        className="fixed bottom-5 right-5 z-40 w-11 h-11 rounded-full bg-slate-800/90 border border-white/15 text-slate-300 hover:text-white hover:border-emerald-500/40 backdrop-blur-xl shadow-xl flex items-center justify-center transition-all cursor-pointer">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={finish} />

          {/* Card */}
          <div className="relative w-full max-w-md bg-slate-900 border border-white/12 rounded-2xl shadow-2xl overflow-hidden">
            {/* Accent strip */}
            <div className="h-1 bg-gradient-to-r from-emerald-500 to-teal-400" />

            <div className="p-6 space-y-4">
              {/* Icon + step count */}
              <div className="flex items-center justify-between">
                <div className="w-11 h-11 rounded-xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center">
                  <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={s.icon} />
                  </svg>
                </div>
                <span className="text-xs text-slate-500 font-mono">{step + 1} / {STEPS.length}</span>
              </div>

              <div>
                <h2 className="text-lg font-bold text-white mb-1.5">{s.title}</h2>
                <p className="text-sm text-slate-400 leading-relaxed">{s.body}</p>
              </div>

              {s.tip && (
                <div className="bg-emerald-500/5 border border-emerald-500/15 rounded-lg px-3 py-2 flex items-start gap-2">
                  <svg className="w-3.5 h-3.5 text-emerald-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  <p className="text-xs text-emerald-300/90">{s.tip}</p>
                </div>
              )}

              {s.link && (
                <Link href={s.link.href} onClick={finish}
                  className="inline-flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 font-medium transition-colors">
                  {s.link.label}
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </Link>
              )}

              {/* Progress dots */}
              <div className="flex items-center gap-1.5 justify-center pt-1">
                {STEPS.map((_, i) => (
                  <button key={i} onClick={() => setStep(i)} aria-label={`Step ${i + 1}`}
                    className={`h-1.5 rounded-full transition-all cursor-pointer ${
                      i === step ? 'w-6 bg-emerald-400' : 'w-1.5 bg-slate-700 hover:bg-slate-600'
                    }`} />
                ))}
              </div>

              {/* Nav */}
              <div className="flex items-center gap-2 pt-1">
                <button onClick={finish}
                  className="text-xs text-slate-500 hover:text-slate-300 transition-colors px-2 py-2 cursor-pointer">
                  Skip
                </button>
                <div className="flex-1" />
                {step > 0 && (
                  <button onClick={() => setStep(s => s - 1)}
                    className="px-4 py-2 rounded-lg text-xs font-medium text-slate-300 border border-white/10 hover:bg-white/5 transition-all cursor-pointer">
                    Back
                  </button>
                )}
                <button onClick={() => isLast ? finish() : setStep(s => s + 1)}
                  className="px-5 py-2 rounded-lg text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 transition-all cursor-pointer">
                  {isLast ? "Let's trade" : 'Next'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
