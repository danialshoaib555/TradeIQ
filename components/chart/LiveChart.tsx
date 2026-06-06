'use client';
import { useEffect, useRef, useState } from 'react';
import type { TradeLevels } from '@/lib/levelCalculator';
import type { SignalResult } from '@/lib/signalEngine';
import type { Pair } from '@/lib/pairConfig';

interface Props {
  pair: Pair;
  levels: TradeLevels | null;
  signal: SignalResult | null;
  tradeType?: 'auto' | 'long' | 'short';
  showEMA?: boolean;
  showBB?: boolean;
  timeframe?: string;
}

// ── Inline indicator helpers ───────────────────────────────────────────────
function ema(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const out: number[] = [];
  let val = values[0];
  for (let i = 0; i < values.length; i++) {
    val = values[i] * k + val * (1 - k);
    out.push(val);
  }
  return out;
}

function bollingerBands(values: number[], period = 20, mult = 2) {
  const upper: number[] = [], middle: number[] = [], lower: number[] = [];
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) { upper.push(NaN); middle.push(NaN); lower.push(NaN); continue; }
    const sl = values.slice(i - period + 1, i + 1);
    const avg = sl.reduce((a, b) => a + b, 0) / period;
    const std = Math.sqrt(sl.reduce((a, b) => a + (b - avg) ** 2, 0) / period);
    middle.push(avg); upper.push(avg + mult * std); lower.push(avg - mult * std);
  }
  return { upper, middle, lower };
}

const TF_TO_BINANCE: Record<string, string> = { '5m': '5m', '15m': '15m', '1h': '1h', '4h': '4h', '1D': '1d' };

export default function LiveChart({ pair, levels, signal, tradeType = 'auto', showEMA = true, showBB = false, timeframe = '1h' }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [ohlcv, setOhlcv] = useState<Array<{ time: number; open: number; high: number; low: number; close: number; volume: number }>>([]);
  const [ready, setReady] = useState(false);
  const [livePrice, setLivePrice] = useState<number | null>(null);
  const [priceChange, setPriceChange] = useState<number>(0);

  // Fetch initial OHLCV data
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

  // Build & manage chart
  useEffect(() => {
    if (!ready || !containerRef.current || ohlcv.length === 0) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let chart: any = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let candleSeries: any = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let markersPlugin: any = null;
    let ws: WebSocket | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let destroyed = false;

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
          timeScale: { borderColor: 'rgba(255,255,255,0.08)', timeVisible: true, secondsVisible: false },
          crosshair: { mode: 1 },
          width:  containerRef.current.clientWidth,
          height: containerRef.current.clientHeight || 420,
        });

        candleSeries = chart.addSeries(LWC.CandlestickSeries, {
          upColor: '#22C55E', downColor: '#EF4444',
          borderUpColor: '#22C55E', borderDownColor: '#EF4444',
          wickUpColor: '#22C55E', wickDownColor: '#EF4444',
        });

        const sorted = [...ohlcv].sort((a, b) => a.time - b.time);
        candleSeries.setData(sorted);

        const closes = sorted.map(c => c.close);
        const times  = sorted.map(c => c.time);

        // ── EMA overlay ───────────────────────────────────────────────────
        if (showEMA && LWC.LineSeries) {
          const ema9vals  = ema(closes, 9);
          const ema21vals = ema(closes, 21);

          const ema9Series = chart.addSeries(LWC.LineSeries, {
            color: '#3B82F6', lineWidth: 1, priceLineVisible: false, lastValueVisible: true,
            crosshairMarkerVisible: false, title: 'EMA9',
          });
          const ema21Series = chart.addSeries(LWC.LineSeries, {
            color: '#F59E0B', lineWidth: 1, priceLineVisible: false, lastValueVisible: true,
            crosshairMarkerVisible: false, title: 'EMA21',
          });
          ema9Series.setData(times.map((t, i) => ({ time: t, value: ema9vals[i] })));
          ema21Series.setData(times.map((t, i) => ({ time: t, value: ema21vals[i] })));
        }

        // ── Bollinger Bands overlay ────────────────────────────────────────
        if (showBB && LWC.LineSeries) {
          const bb = bollingerBands(closes);
          const validFrom = 19; // period - 1

          const bbUpper = chart.addSeries(LWC.LineSeries, {
            color: 'rgba(139,92,246,0.6)', lineWidth: 1, priceLineVisible: false, lastValueVisible: false,
            lineStyle: 2, title: 'BB+',
          });
          const bbMiddle = chart.addSeries(LWC.LineSeries, {
            color: 'rgba(139,92,246,0.3)', lineWidth: 1, priceLineVisible: false, lastValueVisible: false,
            lineStyle: 2, title: 'BB mid',
          });
          const bbLower = chart.addSeries(LWC.LineSeries, {
            color: 'rgba(139,92,246,0.6)', lineWidth: 1, priceLineVisible: false, lastValueVisible: false,
            lineStyle: 2, title: 'BB-',
          });

          const bbData = times.slice(validFrom).map((t, i) => ({
            upper:  { time: t, value: bb.upper[i + validFrom] },
            middle: { time: t, value: bb.middle[i + validFrom] },
            lower:  { time: t, value: bb.lower[i + validFrom] },
          }));
          bbUpper.setData(bbData.map(d => d.upper));
          bbMiddle.setData(bbData.map(d => d.middle));
          bbLower.setData(bbData.map(d => d.lower));
        }

        // ── TP/SL lines ───────────────────────────────────────────────────
        const effectiveDir = tradeType === 'long' ? 'BUY' : tradeType === 'short' ? 'SELL'
          : (signal?.signal ?? 'WAIT');

        if (levels && effectiveDir !== 'WAIT') {
          const line = (price: number, color: string, title: string) =>
            candleSeries.createPriceLine({ price, color, lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title });
          line(levels.entry, '#60A5FA', 'Entry');
          line(levels.sl,    '#EF4444', 'SL');
          line(levels.tp1,   '#4ADE80', 'TP1');
          line(levels.tp2,   '#22C55E', 'TP2');
          line(levels.tp3,   '#16A34A', 'TP3');
        }

        // ── Signal / direction marker ─────────────────────────────────────
        const markerDir = tradeType !== 'auto' ? (tradeType === 'long' ? 'BUY' : 'SELL') : signal?.signal;
        if (LWC.createSeriesMarkers && markerDir && markerDir !== 'WAIT') {
          const last = sorted.at(-1);
          if (last) {
            markersPlugin = LWC.createSeriesMarkers(candleSeries, [{
              time: last.time,
              position: markerDir === 'BUY' ? 'belowBar' : 'aboveBar',
              color: markerDir === 'BUY' ? '#22C55E' : '#EF4444',
              shape: markerDir === 'BUY' ? 'arrowUp' : 'arrowDown',
              text: markerDir === 'BUY' ? (tradeType === 'long' ? 'LONG' : 'BUY') : (tradeType === 'short' ? 'SHORT' : 'SELL'),
            }]);
          }
        }

        chart.timeScale().fitContent();

        // ── Real-time updates ─────────────────────────────────────────────
        const updateLivePrice = (close: number) => {
          const prev = sorted.at(-2)?.close ?? close;
          setLivePrice(close);
          setPriceChange(((close - prev) / prev) * 100);
        };

        if (pair.binanceSymbol && pair.market === 'crypto') {
          // WebSocket for crypto — direct from Binance
          const wsInterval = TF_TO_BINANCE[timeframe] ?? '1h';
          const wsUrl = `wss://stream.binance.com:9443/ws/${pair.binanceSymbol.toLowerCase()}@kline_${wsInterval}`;
          try {
            ws = new WebSocket(wsUrl);
            ws.onmessage = (evt) => {
              if (destroyed || !candleSeries) return;
              const d = JSON.parse(evt.data);
              const k = d.k;
              const candle = {
                time: Math.floor(k.t / 1000),
                open:   parseFloat(k.o),
                high:   parseFloat(k.h),
                low:    parseFloat(k.l),
                close:  parseFloat(k.c),
              };
              candleSeries.update(candle);
              updateLivePrice(candle.close);
            };
            ws.onerror = () => {
              // fall back to polling on WS error
              ws = null;
              if (!destroyed) startPolling();
            };
          } catch { startPolling(); }
        } else {
          startPolling();
        }

        function startPolling() {
          pollTimer = setInterval(async () => {
            if (destroyed) return;
            try {
              const res = await fetch(`/api/ohlcv/${pair.id}?tf=${timeframe}`);
              const data = await res.json();
              if (Array.isArray(data) && data.length > 0) {
                const last = data[data.length - 1];
                candleSeries?.update(last);
                updateLivePrice(last.close);
              }
            } catch {}
          }, 30_000);
        }

        // Resize observer
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

    const cleanupPromise = init();
    return () => {
      destroyed = true;
      cleanupPromise.then(fn => fn?.());
      if (ws) { ws.close(); ws = null; }
      if (pollTimer) clearInterval(pollTimer);
      markersPlugin?.detach?.();
      chart?.remove();
      chart = null; candleSeries = null;
    };
  // Re-init when data, indicators, or direction changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, ohlcv, levels, signal, showEMA, showBB, tradeType]);

  const isLong  = tradeType === 'long'  || (tradeType === 'auto' && signal?.signal === 'BUY');
  const isShort = tradeType === 'short' || (tradeType === 'auto' && signal?.signal === 'SELL');

  return (
    <div className="relative w-full h-full min-h-[420px]">
      {/* Direction indicator strip */}
      {(isLong || isShort) && (
        <div className={`absolute top-0 left-0 right-0 h-0.5 z-20 ${isLong ? 'bg-emerald-500' : 'bg-red-500'}`} />
      )}

      {/* Live price badge */}
      {livePrice !== null && (
        <div className="absolute top-3 left-3 z-20 flex items-center gap-2">
          <div className="bg-slate-900/90 border border-white/10 rounded-lg px-3 py-1.5 flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-mono text-sm font-bold text-white">
              {livePrice.toLocaleString(undefined, { minimumFractionDigits: pair.pipSize <= 0.0001 ? 5 : pair.pipSize <= 0.01 ? 3 : 2, maximumFractionDigits: pair.pipSize <= 0.0001 ? 5 : pair.pipSize <= 0.01 ? 3 : 2 })}
            </span>
            <span className={`font-mono text-xs font-medium ${priceChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
            </span>
          </div>
          {(isLong || isShort) && (
            <div className={`px-2 py-1 rounded-lg border text-xs font-bold ${isLong ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' : 'bg-red-500/20 border-red-500/40 text-red-400'}`}>
              {isLong ? '↑ LONG' : '↓ SHORT'}
            </div>
          )}
        </div>
      )}

      <div ref={containerRef} className="w-full h-full min-h-[420px]" />

      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 rounded-xl z-10">
          <div className="flex items-center gap-2 text-slate-400">
            <div className="w-5 h-5 border-2 border-slate-500 border-t-emerald-400 rounded-full animate-spin" />
            Loading chart…
          </div>
        </div>
      )}
      {ready && ohlcv.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-sm">
          No chart data available for this pair
        </div>
      )}
    </div>
  );
}
