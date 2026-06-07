'use client';
import { useEffect, useRef, useState } from 'react';
import type { TradeLevels } from '@/lib/levelCalculator';
import type { SignalResult } from '@/lib/signalEngine';
import type { Pair } from '@/lib/pairConfig';
import type { BacktestTrade, StrategyKey } from '@/lib/backtester';

export type ChartStyle = 'candles' | 'heikin-ashi' | 'bars' | 'line' | 'area';

interface Props {
  pair: Pair;
  levels: TradeLevels | null;
  signal: SignalResult | null;
  tradeType?: 'auto' | 'long' | 'short' | 'spot';
  selectedStrategy?: StrategyKey;
  backtestTrades?: BacktestTrade[];
  timeframe?: string;
  chartStyle?: ChartStyle;
}

type OHLCVBar = { time: number; open: number; high: number; low: number; close: number; volume: number };

// ── Indicator helpers ──────────────────────────────────────────────────────
function emaCalc(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const out: number[] = [];
  let val = values[0];
  for (let i = 0; i < values.length; i++) {
    val = values[i] * k + val * (1 - k);
    out.push(val);
  }
  return out;
}

function bbCalc(values: number[], period = 20, mult = 2) {
  const upper: number[] = [], middle: number[] = [], lower: number[] = [];
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) { upper.push(NaN); middle.push(NaN); lower.push(NaN); continue; }
    const sl  = values.slice(i - period + 1, i + 1);
    const avg = sl.reduce((a, b) => a + b, 0) / period;
    const std = Math.sqrt(sl.reduce((a, b) => a + (b - avg) ** 2, 0) / period);
    middle.push(avg); upper.push(avg + mult * std); lower.push(avg - mult * std);
  }
  return { upper, middle, lower };
}

function toHeikinAshi(bars: OHLCVBar[]): OHLCVBar[] {
  const ha: OHLCVBar[] = [];
  for (let i = 0; i < bars.length; i++) {
    const b = bars[i];
    const haClose = (b.open + b.high + b.low + b.close) / 4;
    const haOpen  = i === 0 ? (b.open + b.close) / 2 : (ha[i - 1].open + ha[i - 1].close) / 2;
    const haHigh  = Math.max(b.high, haOpen, haClose);
    const haLow   = Math.min(b.low,  haOpen, haClose);
    ha.push({ time: b.time, open: haOpen, high: haHigh, low: haLow, close: haClose, volume: b.volume });
  }
  return ha;
}

const STRATEGY_OVERLAYS: Record<StrategyKey, { ema: boolean; bb: boolean }> = {
  ema_cross:      { ema: true,  bb: false },
  trend_pullback: { ema: true,  bb: false },
  supertrend:     { ema: true,  bb: false },
  ma_ribbon:      { ema: true,  bb: false },
  rsi_divergence: { ema: false, bb: true  },
  double_bottom:  { ema: true,  bb: true  },
  head_shoulders: { ema: false, bb: false },
  pin_bar:        { ema: true,  bb: false },
  engulfing:      { ema: true,  bb: false },
  bb_squeeze:     { ema: true,  bb: true  },
  donchian:       { ema: false, bb: false },
  orb:            { ema: false, bb: false },
  order_block:    { ema: true,  bb: false },
  liquidity_grab: { ema: false, bb: false },
  fvg:            { ema: false, bb: false },
  structure_break:{ ema: true,  bb: false },
  macd_cross:     { ema: true,  bb: false },
  stoch_rsi:      { ema: false, bb: true  },
  vpa:            { ema: true,  bb: false },
  rsi_reversal:   { ema: false, bb: true  },
  keltner:        { ema: true,  bb: false },
  news_trade:     { ema: false, bb: false },
  news_confluence:{ ema: true,  bb: false },
  mtf_analysis:   { ema: true,  bb: false },
  weekly_level:   { ema: true,  bb: false },
};

const TF_TO_BINANCE: Record<string, string> = {
  '1m':'1m','3m':'3m','5m':'5m','15m':'15m','30m':'30m',
  '1h':'1h','2h':'2h','4h':'4h','6h':'6h','12h':'12h',
  '1D':'1d','1W':'1w','1M':'1M',
};

// How many candles to keep visible at right-side of screen (TradingView-like default view)
const TF_VISIBLE_BARS: Record<string, number> = {
  '1m':120,'3m':120,'5m':100,'15m':80,'30m':60,
  '1h':60,'2h':60,'4h':50,'6h':40,'12h':30,
  '1D':60,'1W':52,'1M':24,
};

export default function LiveChart({ pair, levels, signal, tradeType = 'auto', selectedStrategy, backtestTrades, timeframe = '1h', chartStyle = 'candles' }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [ohlcv, setOhlcv]         = useState<OHLCVBar[]>([]);
  const [ready, setReady]         = useState(false);
  const [livePrice, setLivePrice] = useState<number | null>(null);
  const [priceChange, setPriceChange] = useState<number>(0);

  useEffect(() => {
    setReady(false);
    setOhlcv([]);
    setLivePrice(null);
    fetch(`/api/ohlcv/${pair.id}?tf=${timeframe}`)
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setOhlcv(data); })
      .catch(() => {})
      .finally(() => setReady(true));
  }, [pair.id, timeframe]);

  useEffect(() => {
    if (!ready || !containerRef.current || ohlcv.length === 0) return;

    const overlays   = selectedStrategy ? STRATEGY_OVERLAYS[selectedStrategy] : { ema: true, bb: false };
    const isOHLC     = chartStyle === 'candles' || chartStyle === 'bars' || chartStyle === 'heikin-ashi';

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let chart: any       = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let mainSeries: any  = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let markersPlugin: any = null;
    let ws: WebSocket | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let destroyed = false;

    // Keep mutable copy of latest bars for HA updates
    const liveBars = [...ohlcv].sort((a, b) => a.time - b.time);

    const init = async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const LWC = await import('lightweight-charts') as any;
        if (destroyed || !containerRef.current) return;

        chart = LWC.createChart(containerRef.current, {
          layout: { background: { color: 'transparent' }, textColor: '#94A3B8' },
          grid: {
            vertLines: { color: 'rgba(255,255,255,0.04)' },
            horzLines: { color: 'rgba(255,255,255,0.04)' },
          },
          rightPriceScale: { borderColor: 'rgba(255,255,255,0.08)' },
          timeScale: {
            borderColor: 'rgba(255,255,255,0.08)',
            timeVisible: true,
            secondsVisible: false,
            rightOffset: 5,          // breathing room for the live candle
            fixLeftEdge: false,
            lockVisibleTimeRangeOnResize: true,
          },
          crosshair: { mode: 1 },
          width:  containerRef.current.clientWidth,
          height: containerRef.current.clientHeight || 420,
          handleScroll: true,
          handleScale: true,
        });

        const sorted = liveBars;
        const closes = sorted.map(c => c.close);
        const times  = sorted.map(c => c.time);

        // ── Main series ──────────────────────────────────────────────────
        if (chartStyle === 'line') {
          mainSeries = chart.addSeries(LWC.LineSeries, {
            color: '#22C55E', lineWidth: 2, priceLineVisible: true, lastValueVisible: true,
          });
          mainSeries.setData(sorted.map(c => ({ time: c.time, value: c.close })));

        } else if (chartStyle === 'area') {
          mainSeries = chart.addSeries(LWC.AreaSeries, {
            lineColor: '#22C55E', topColor: 'rgba(34,197,94,0.25)', bottomColor: 'rgba(34,197,94,0.02)',
            lineWidth: 2, priceLineVisible: true, lastValueVisible: true,
          });
          mainSeries.setData(sorted.map(c => ({ time: c.time, value: c.close })));

        } else if (chartStyle === 'bars') {
          mainSeries = chart.addSeries(LWC.BarSeries, {
            upColor: '#22C55E', downColor: '#EF4444', openVisible: true, thinBars: false,
          });
          mainSeries.setData(sorted);

        } else if (chartStyle === 'heikin-ashi') {
          mainSeries = chart.addSeries(LWC.CandlestickSeries, {
            upColor: '#22C55E', downColor: '#EF4444',
            borderUpColor: '#22C55E', borderDownColor: '#EF4444',
            wickUpColor: '#22C55E', wickDownColor: '#EF4444',
          });
          mainSeries.setData(toHeikinAshi(sorted));

        } else {
          mainSeries = chart.addSeries(LWC.CandlestickSeries, {
            upColor: '#22C55E', downColor: '#EF4444',
            borderUpColor: '#22C55E', borderDownColor: '#EF4444',
            wickUpColor: '#22C55E', wickDownColor: '#EF4444',
          });
          mainSeries.setData(sorted);
        }

        // ── EMA overlay ───────────────────────────────────────────────────
        if (overlays.ema && LWC.LineSeries) {
          const e9  = emaCalc(closes, 9);
          const e21 = emaCalc(closes, 21);
          const ema9s  = chart.addSeries(LWC.LineSeries, { color: '#3B82F6', lineWidth: 1, priceLineVisible: false, lastValueVisible: true, crosshairMarkerVisible: false, title: 'EMA9' });
          const ema21s = chart.addSeries(LWC.LineSeries, { color: '#F59E0B', lineWidth: 1, priceLineVisible: false, lastValueVisible: true, crosshairMarkerVisible: false, title: 'EMA21' });
          ema9s.setData(times.map((t, i) => ({ time: t, value: e9[i] })));
          ema21s.setData(times.map((t, i) => ({ time: t, value: e21[i] })));
        }

        // ── Bollinger Bands ───────────────────────────────────────────────
        if (overlays.bb && LWC.LineSeries) {
          const bb = bbCalc(closes);
          const from = 19;
          const mkBB = (color: string, title: string) => chart.addSeries(LWC.LineSeries, {
            color, lineWidth: 1, priceLineVisible: false, lastValueVisible: false, lineStyle: 2, title,
          });
          const bbU = mkBB('rgba(168,85,247,0.7)', 'BB+');
          const bbM = mkBB('rgba(168,85,247,0.35)', 'BB');
          const bbL = mkBB('rgba(168,85,247,0.7)', 'BB-');
          bbU.setData(times.slice(from).map((t, i) => ({ time: t, value: bb.upper[i + from] })));
          bbM.setData(times.slice(from).map((t, i) => ({ time: t, value: bb.middle[i + from] })));
          bbL.setData(times.slice(from).map((t, i) => ({ time: t, value: bb.lower[i + from] })));
        }

        // ── TP/SL price lines ─────────────────────────────────────────────
        const effectiveDir = tradeType === 'long' ? 'BUY' : tradeType === 'short' ? 'SELL' : (signal?.signal ?? 'WAIT');
        if (levels && effectiveDir !== 'WAIT') {
          const line = (price: number, color: string, title: string) =>
            mainSeries.createPriceLine({ price, color, lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title });
          line(levels.entry, '#60A5FA', 'Entry');
          line(levels.sl,    '#EF4444', 'SL');
          line(levels.tp1,   '#4ADE80', 'TP1');
          line(levels.tp2,   '#22C55E', 'TP2');
          line(levels.tp3,   '#16A34A', 'TP3');
        }

        // ── Backtest markers ──────────────────────────────────────────────
        if (LWC.createSeriesMarkers) {
          const allMarkers: unknown[] = [];
          if (backtestTrades && backtestTrades.length > 0) {
            for (const t of backtestTrades.slice(-20)) {
              allMarkers.push({ time: t.entryTime, position: t.direction === 'BUY' ? 'belowBar' : 'aboveBar', color: t.direction === 'BUY' ? '#60A5FA' : '#F87171', shape: t.direction === 'BUY' ? 'arrowUp' : 'arrowDown', text: t.direction === 'BUY' ? 'B' : 'S', size: 1 });
              if (t.outcome !== 'open') allMarkers.push({ time: t.exitTime, position: t.direction === 'BUY' ? 'aboveBar' : 'belowBar', color: t.outcome === 'win' ? '#22C55E' : '#EF4444', shape: 'circle', text: t.outcome === 'win' ? '✓' : '✗', size: 0.5 });
            }
          }
          const markerDir = tradeType !== 'auto' ? (tradeType === 'long' ? 'BUY' : tradeType === 'short' ? 'SELL' : undefined) : signal?.signal;
          const last = sorted.at(-1);
          if (last && markerDir && markerDir !== 'WAIT') {
            allMarkers.push({ time: last.time, position: markerDir === 'BUY' ? 'belowBar' : 'aboveBar', color: markerDir === 'BUY' ? '#22C55E' : '#EF4444', shape: markerDir === 'BUY' ? 'arrowUp' : 'arrowDown', text: markerDir === 'BUY' ? (tradeType === 'long' ? 'LONG' : 'BUY') : (tradeType === 'short' ? 'SHORT' : 'SELL'), size: 2 });
          }
          allMarkers.sort((a: unknown, b: unknown) => ((a as {time:number}).time - (b as {time:number}).time));
          if (allMarkers.length > 0) markersPlugin = LWC.createSeriesMarkers(mainSeries, allMarkers);
        }

        // ── Zoom to last N bars (TradingView default behavior) ────────────
        const visibleBars = TF_VISIBLE_BARS[timeframe] ?? 60;
        if (sorted.length > visibleBars) {
          // Show the last N candles + rightOffset breathing room
          const from = sorted[sorted.length - visibleBars].time;
          const to   = sorted[sorted.length - 1].time;
          chart.timeScale().setVisibleRange({ from, to });
        } else {
          chart.timeScale().fitContent();
        }
        // Always scroll to show the latest candle at the right
        chart.timeScale().scrollToRealTime();

        // ── Live price update helper ───────────────────────────────────────
        const updatePrice = (close: number, prevClose: number) => {
          setLivePrice(close);
          setPriceChange(prevClose > 0 ? ((close - prevClose) / prevClose) * 100 : 0);
        };

        // ── Binance kline WebSocket for crypto ────────────────────────────
        if (pair.binanceSymbol && pair.market === 'crypto') {
          const wsInterval = TF_TO_BINANCE[timeframe] ?? '1h';
          try {
            ws = new WebSocket(`wss://stream.binance.com:9443/ws/${pair.binanceSymbol.toLowerCase()}@kline_${wsInterval}`);

            ws.onmessage = (evt) => {
              if (destroyed || !mainSeries) return;
              const { k } = JSON.parse(evt.data) as { k: { t: number; o: string; h: string; l: string; c: string; x: boolean } };

              // Binance kline open-time is in ms → convert to seconds
              const candleTime = Math.floor(k.t / 1000);
              const o = parseFloat(k.o), h = parseFloat(k.h), lo = parseFloat(k.l), c = parseFloat(k.c);

              // Sanity check: ignore candles with obviously wrong timestamps
              const nowSec = Math.floor(Date.now() / 1000);
              if (candleTime > nowSec + 10 || candleTime < nowSec - 86400 * 30) return;

              const lastBar   = liveBars.at(-1);
              const prevClose = liveBars.at(-2)?.close ?? o;

              if (lastBar && lastBar.time === candleTime) {
                // Updating the current open candle — keep running H/L
                lastBar.high  = Math.max(lastBar.high, h);
                lastBar.low   = Math.min(lastBar.low, lo);
                lastBar.close = c;
              } else if (!lastBar || candleTime > lastBar.time) {
                // Brand-new candle: close the previous one first by finalising its data,
                // then add the new bar. No gap will appear because candleTime is exactly
                // the next expected interval step.
                liveBars.push({ time: candleTime, open: o, high: h, low: lo, close: c, volume: 0 });
                if (liveBars.length > 600) liveBars.shift();
              }

              // Push update to chart
              if (isOHLC) {
                if (chartStyle === 'heikin-ashi') {
                  const prev = liveBars.length >= 2 ? liveBars[liveBars.length - 2] : null;
                  if (prev) {
                    const haOpen  = (prev.open + prev.close) / 2;
                    const haClose = (o + h + lo + c) / 4;
                    mainSeries.update({
                      time:  candleTime,
                      open:  haOpen,
                      high:  Math.max(h, haOpen, haClose),
                      low:   Math.min(lo, haOpen, haClose),
                      close: haClose,
                    });
                  }
                } else {
                  mainSeries.update({ time: candleTime, open: o, high: h, low: lo, close: c });
                }
              } else {
                mainSeries.update({ time: candleTime, value: c });
              }

              updatePrice(c, prevClose);
              chart?.timeScale().scrollToRealTime();
            };

            ws.onerror = () => { ws = null; startPolling(); };
            ws.onclose = () => { if (!destroyed) { ws = null; startPolling(); } };
          } catch { startPolling(); }

        } else {
          // Non-crypto: poll every 30s
          startPolling();
        }

        function startPolling() {
          // Initial live price from last known bar
          const last = liveBars.at(-1);
          const prev = liveBars.at(-2);
          if (last) updatePrice(last.close, prev?.close ?? last.close);

          pollTimer = setInterval(async () => {
            if (destroyed) return;
            try {
              const res  = await fetch(`/api/ohlcv/${pair.id}?tf=${timeframe}`);
              const data = await res.json();
              if (!Array.isArray(data) || data.length === 0) return;
              const last = data[data.length - 1];
              const prev = data[data.length - 2];
              if (isOHLC) mainSeries?.update(last);
              else        mainSeries?.update({ time: last.time, value: last.close });
              updatePrice(last.close, prev?.close ?? last.close);
              chart?.timeScale().scrollToRealTime();
            } catch {}
          }, 30_000);
        }

        const ro = new ResizeObserver(() => {
          if (containerRef.current && chart) {
            chart.resize(containerRef.current.clientWidth, containerRef.current.clientHeight || 420);
          }
        });
        ro.observe(containerRef.current!);
        return () => ro.disconnect();

      } catch (e) {
        console.error('Chart init error:', e);
      }
    };

    const cp = init();
    return () => {
      destroyed = true;
      cp.then(fn => fn?.());
      ws?.close();
      if (pollTimer) clearInterval(pollTimer);
      markersPlugin?.detach?.();
      chart?.remove();
      chart = null; mainSeries = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, ohlcv, levels, signal, selectedStrategy, backtestTrades, tradeType, chartStyle]);

  const isLong  = tradeType === 'long'  || (tradeType === 'auto' && signal?.signal === 'BUY');
  const isShort = tradeType === 'short' || (tradeType === 'auto' && signal?.signal === 'SELL');
  const decPlaces = pair.pipSize <= 0.0001 ? 5 : pair.pipSize <= 0.01 ? 3 : 2;

  return (
    <div className="relative w-full h-full min-h-[400px]">
      {(isLong || isShort) && (
        <div className={`absolute top-0 left-0 right-0 h-0.5 z-20 ${isLong ? 'bg-emerald-500' : 'bg-red-500'}`} />
      )}

      {livePrice !== null && (
        <div className="absolute top-3 left-3 z-20 flex items-center gap-2 flex-wrap">
          <div className="bg-slate-900/95 border border-white/12 rounded-xl px-3 py-1.5 flex items-center gap-2.5 backdrop-blur-sm shadow-lg">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-mono text-sm font-bold text-white tracking-wider">
              {livePrice.toLocaleString(undefined, { minimumFractionDigits: decPlaces, maximumFractionDigits: decPlaces })}
            </span>
            <span className={`font-mono text-xs font-semibold px-1.5 py-0.5 rounded ${priceChange >= 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
              {priceChange >= 0 ? '▲' : '▼'} {Math.abs(priceChange).toFixed(2)}%
            </span>
          </div>
          {(isLong || isShort) && (
            <div className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold backdrop-blur-sm ${isLong ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' : 'bg-red-500/20 border-red-500/40 text-red-400'}`}>
              {isLong ? '↑ LONG' : '↓ SHORT'}
            </div>
          )}
        </div>
      )}

      <div ref={containerRef} className="w-full h-full min-h-[400px]" />

      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 rounded-xl z-10">
          <div className="flex items-center gap-2 text-slate-400">
            <div className="w-5 h-5 border-2 border-slate-500 border-t-emerald-400 rounded-full animate-spin" />
            Loading chart…
          </div>
        </div>
      )}
      {ready && ohlcv.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-sm">No chart data</div>
      )}

      {/* Legend */}
      {selectedStrategy && ohlcv.length > 0 && (
        <div className="absolute bottom-3 left-3 z-20 flex items-center gap-2 flex-wrap">
          {STRATEGY_OVERLAYS[selectedStrategy].ema && (
            <>
              <div className="flex items-center gap-1 bg-slate-900/80 rounded px-2 py-1 border border-white/8">
                <div className="w-3 h-0.5 bg-blue-500" /><span className="text-xs text-slate-400">EMA9</span>
              </div>
              <div className="flex items-center gap-1 bg-slate-900/80 rounded px-2 py-1 border border-white/8">
                <div className="w-3 h-0.5 bg-amber-500" /><span className="text-xs text-slate-400">EMA21</span>
              </div>
            </>
          )}
          {STRATEGY_OVERLAYS[selectedStrategy].bb && (
            <div className="flex items-center gap-1 bg-slate-900/80 rounded px-2 py-1 border border-white/8">
              <div className="w-3 h-0.5 bg-purple-500" /><span className="text-xs text-slate-400">BB</span>
            </div>
          )}
          {backtestTrades && backtestTrades.length > 0 && (
            <>
              <div className="flex items-center gap-1 bg-slate-900/80 rounded px-2 py-1 border border-white/8">
                <span className="text-xs text-blue-400">B/S</span><span className="text-xs text-slate-500">= backtest entries</span>
              </div>
              <div className="flex items-center gap-1 bg-slate-900/80 rounded px-2 py-1 border border-white/8">
                <span className="text-xs text-emerald-400">✓</span><span className="text-xs text-slate-500">win</span>
                <span className="text-xs text-red-400 ml-1">✗</span><span className="text-xs text-slate-500">loss</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
