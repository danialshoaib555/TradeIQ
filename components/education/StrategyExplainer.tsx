import Link from 'next/link';

const CONTENT: Record<string, { title: string; tagline: string; what: string; when: string; entrySteps: string[]; exitSteps: string[]; mistakes: string[]; checklist: string[] }> = {
  ema_cross: {
    title: 'EMA Crossover Strategy', tagline: 'Follow the trend with moving average crossovers',
    what: 'The EMA crossover strategy uses two moving averages — faster (9 periods) and slower (21 periods). When the fast EMA crosses above the slow EMA, momentum has turned bullish. Works best in trending markets.',
    when: 'Use when the market has been moving consistently in one direction for at least 2 hours. Avoid during news events or choppy sideways markets.',
    entrySteps: ['Wait for EMA 9 to cross above EMA 21 (bullish) or below (bearish)', 'Confirm RSI is between 35-65 (not extreme)', 'Check price is above EMA 21 for buys, below for sells', 'Verify volume is above average (1.2x+)', 'Enter at the closing price of the crossover candle'],
    exitSteps: ['Place stop loss below the most recent swing low (for buys)', 'TP1 at 1.5x your risk — take 50% profit here', 'Move stop to breakeven after TP1 hits', 'TP2 at 2.5x risk — take another 30%', 'Let remainder run to TP3 (4x risk) or until EMA crosses back'],
    mistakes: ['Trading EMA crossovers in sideways markets', 'Entering too late after the crossover', 'Ignoring volume — crossover with no volume is unreliable', 'Not moving stop to breakeven after TP1'],
    checklist: ['Is the market clearly trending for 2+ hours?', 'Did EMA 9 cross EMA 21?', 'Is RSI between 35-65?', 'Is volume above average?', 'Did you set your stop loss?', 'Is your position size within 2% risk?'],
  },
  rsi_reversal: {
    title: 'RSI Reversal Strategy', tagline: 'Buy when oversold, sell when overbought',
    what: 'RSI measures momentum on a scale of 0-100. Below 30 = oversold (bounce likely). Above 70 = overbought (pullback expected). Best for range-bound markets.',
    when: 'Best when the market has been in a range (not trending strongly). Avoid when ADX is above 25.',
    entrySteps: ['Wait for RSI to drop below 30 (buy) or rise above 70 (sell)', 'Confirm price is near a known support or resistance', 'Look for a reversal candle: hammer, engulfing, or doji', 'Check ADX is below 25 (no strong trend)', 'Enter on the close of the reversal candle'],
    exitSteps: ['Stop loss just below the recent low (buys)', 'TP1 at the middle of the recent range', 'TP2 at the opposite side of the range', 'Exit if RSI re-enters the extreme zone'],
    mistakes: ['Fading a strong trend — RSI can stay oversold in a downtrend', 'Not waiting for a reversal candle', 'Setting TP too far — RSI reversals are range plays'],
    checklist: ['Is RSI below 30 or above 70?', 'Is ADX below 25?', 'Is price at a known support or resistance?', 'Is there a reversal candle?', 'Did you set a stop loss?'],
  },
  bb_squeeze: {
    title: 'Bollinger Band Squeeze', tagline: 'Catch big moves after low volatility',
    what: 'Bollinger Bands expand/contract based on volatility. When bands squeeze tight, a big move is building. Trade the breakout direction when price bursts out.',
    when: 'Look for this after 5+ candles of very little price movement. Often happens before major news or during Asian sessions.',
    entrySteps: ['Identify a BB squeeze: bands very narrow and close together', 'Wait for price to break above upper band (buy) or below lower (sell)', 'Volume should spike on the breakout candle', 'MACD should confirm direction', 'Enter on the close of the breakout candle'],
    exitSteps: ['Stop loss inside the squeeze range', 'TP1 at 1.5x the squeeze range size', 'TP2 and TP3 at 2.5x and 4x', 'Exit if price closes back inside the bands (failed breakout)'],
    mistakes: ['Trading before the breakout — wait for confirmation', 'Ignoring volume on the breakout', 'Setting stops too tight'],
    checklist: ['Are Bollinger Bands squeezed tightly?', 'Has price been consolidating for 5+ candles?', 'Did price break decisively out of the bands?', 'Is volume spiking?', 'Does MACD confirm direction?'],
  },
  sr_bounce: {
    title: 'Support & Resistance Bounce', tagline: 'Trade from levels where price bounced before',
    what: 'Support is where buying stopped a decline. Resistance is where selling stopped a rally. Price bounces from these levels repeatedly — excellent entry points.',
    when: 'Works in all market conditions. Find levels where price bounced at least twice. The more tests, the stronger the level.',
    entrySteps: ['Identify a key support or resistance on the daily chart', 'Wait for price to return to that level', 'Look for a reversal candle at the level', 'RSI should be near extremes (oversold at support)', 'Enter on the break of the reversal candle\'s high/low'],
    exitSteps: ['Stop loss just beyond the key level', 'TP1 at the next significant level', 'TP2 at the level after that', 'If the level breaks cleanly, exit immediately'],
    mistakes: ['Trading the first touch — wait for a reaction first', 'Placing stop exactly at the level — wicks will hit it', 'Ignoring the bigger trend direction'],
    checklist: ['Has this level been tested at least 2 times?', 'Is there a reversal candle at the level?', 'Is RSI confirming?', 'Is your stop safely beyond the level?'],
  },
  macd_cross: {
    title: 'MACD Crossover Strategy', tagline: 'Ride momentum shifts with MACD',
    what: 'MACD measures momentum. When MACD crosses above signal line with histogram turning positive, bullish momentum is building. Most powerful on 4h and daily charts.',
    when: 'Best for swing trades on 4h or daily charts lasting 1-5 days. Strongest when crossover happens below zero (bullish) or above zero (bearish).',
    entrySteps: ['Watch for MACD line to cross above signal line', 'Strongest signal: crossover below the zero line', 'Histogram should be turning positive', 'EMA 21 should point in your direction', 'Enter at the close of the crossover candle'],
    exitSteps: ['Stop loss below the most recent swing low', 'TP1 when histogram starts shrinking', 'TP2 at 2.5x risk', 'Full exit when MACD crosses back below signal line'],
    mistakes: ['Using MACD alone on 5-minute charts — too many false signals', 'Not waiting for the histogram to confirm', 'Ignoring the zero line level'],
    checklist: ['Did MACD cross the signal line?', 'Did the histogram turn positive?', 'Is the crossover happening below zero?', 'Is this on a 4h or daily chart?', 'Is EMA 21 confirming?'],
  },
};

export default function StrategyExplainer({ strategyKey }: { strategyKey: string }) {
  const c = CONTENT[strategyKey];
  if (!c) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-400 mb-2">Strategy not found.</p>
        <Link href="/strategies" className="text-emerald-400 hover:text-emerald-300 text-sm cursor-pointer">← Back to strategies</Link>
      </div>
    );
  }

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="bg-white/2 border border-white/8 rounded-2xl p-6">
      <h2 className="font-semibold text-white mb-4">{title}</h2>
      {children}
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">{c.title}</h1>
        <p className="text-slate-400">{c.tagline}</p>
      </div>

      <Section title="What is it?">
        <p className="text-slate-300 leading-relaxed">{c.what}</p>
      </Section>

      <Section title="When to use it">
        <p className="text-slate-300 leading-relaxed">{c.when}</p>
      </Section>

      <Section title="Entry rules — step by step">
        <ol className="space-y-2">
          {c.entrySteps.map((step, i) => (
            <li key={i} className="flex items-start gap-3 text-slate-300 text-sm">
              <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs flex items-center justify-center flex-shrink-0 mt-0.5">{i+1}</span>
              {step}
            </li>
          ))}
        </ol>
      </Section>

      <Section title="Exit rules">
        <ol className="space-y-2">
          {c.exitSteps.map((step, i) => (
            <li key={i} className="flex items-start gap-3 text-slate-300 text-sm">
              <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 text-xs flex items-center justify-center flex-shrink-0 mt-0.5">{i+1}</span>
              {step}
            </li>
          ))}
        </ol>
      </Section>

      <Section title="Common mistakes">
        <ul className="space-y-2">
          {c.mistakes.map((m, i) => (
            <li key={i} className="flex items-start gap-3 text-sm">
              <svg className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              <span className="text-slate-400">{m}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Practice checklist">
        <p className="text-sm text-slate-500 mb-3">Check every box before taking this trade:</p>
        <div className="space-y-2">
          {c.checklist.map((item, i) => (
            <label key={i} className="flex items-center gap-3 cursor-pointer group">
              <input type="checkbox" className="w-4 h-4 rounded accent-emerald-500 cursor-pointer" />
              <span className="text-sm text-slate-400 group-hover:text-slate-300 transition-colors">{item}</span>
            </label>
          ))}
        </div>
      </Section>

      <div className="flex gap-3 pt-2">
        <Link href="/strategies" className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-slate-400 hover:text-white cursor-pointer transition-all">← All Strategies</Link>
        <Link href="/" className="px-4 py-2 bg-emerald-500/15 border border-emerald-500/25 rounded-lg text-sm text-emerald-400 hover:bg-emerald-500/20 cursor-pointer transition-all">View Live Signals</Link>
      </div>
    </div>
  );
}
