'use client';
import { useEffect, useRef, useState } from 'react';
import type { TradeLevels } from '@/lib/levelCalculator';
import type { SignalResult } from '@/lib/signalEngine';

interface Props {
  pairId: string;
  levels: TradeLevels | null;
  signal: SignalResult | null;
  showEMA?: boolean;
  showBB?: boolean;
  timeframe?: string;
}

export default function LiveChart({ pairId, levels, signal, timeframe = '1h' }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [ohlcv, setOhlcv] = useState<Array<{ time: number; open: number; high: number; low: number; close: number }>>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(false);
    setOhlcv([]);
    fetch(`/api/ohlcv/${pairId}?tf=${timeframe}`)
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setOhlcv(data); })
      .catch(() => {})
      .finally(() => setReady(true));
  }, [pairId, timeframe]);

  useEffect(() => {
    if (!ready || !containerRef.current || ohlcv.length === 0) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let chart: any = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let markersPlugin: any = null;

    const init = async () => {
      try {
        // lightweight-charts v5 API
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const LWC = await import('lightweight-charts') as any;
        if (!containerRef.current) return;

        chart = LWC.createChart(containerRef.current, {
          layout: {
            background: { color: 'transparent' },
            textColor: '#94A3B8',
          },
          grid: {
            vertLines: { color: 'rgba(255,255,255,0.04)' },
            horzLines: { color: 'rgba(255,255,255,0.04)' },
          },
          rightPriceScale: { borderColor: 'rgba(255,255,255,0.08)' },
          timeScale: {
            borderColor: 'rgba(255,255,255,0.08)',
            timeVisible: true,
            secondsVisible: false,
          },
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight || 420,
        });

        // v5: addSeries(SeriesType, options)
        const candleSeries = chart.addSeries(LWC.CandlestickSeries, {
          upColor: '#22C55E',
          downColor: '#EF4444',
          borderUpColor: '#22C55E',
          borderDownColor: '#EF4444',
          wickUpColor: '#22C55E',
          wickDownColor: '#EF4444',
        });

        const sorted = [...ohlcv].sort((a, b) => a.time - b.time);
        candleSeries.setData(sorted);

        // Price lines for TP/SL
        if (levels && signal && signal.signal !== 'WAIT') {
          const makeLine = (price: number, color: string, title: string) =>
            candleSeries.createPriceLine({ price, color, lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title });
          makeLine(levels.entry, '#60A5FA', 'Entry');
          makeLine(levels.sl,    '#EF4444', 'SL');
          makeLine(levels.tp1,   '#4ADE80', 'TP1');
          makeLine(levels.tp2,   '#22C55E', 'TP2');
          makeLine(levels.tp3,   '#16A34A', 'TP3');

          // v5: createSeriesMarkers plugin
          if (LWC.createSeriesMarkers) {
            const last = sorted.at(-1);
            if (last) {
              markersPlugin = LWC.createSeriesMarkers(candleSeries, [{
                time: last.time,
                position: signal.signal === 'BUY' ? 'belowBar' : 'aboveBar',
                color: signal.signal === 'BUY' ? '#22C55E' : '#EF4444',
                shape: signal.signal === 'BUY' ? 'arrowUp' : 'arrowDown',
                text: signal.signal,
              }]);
            }
          }
        }

        chart.timeScale().fitContent();

        const ro = new ResizeObserver(() => {
          if (containerRef.current && chart) {
            chart.resize(
              containerRef.current.clientWidth,
              containerRef.current.clientHeight || 420
            );
          }
        });
        if (containerRef.current) ro.observe(containerRef.current);

        return () => ro.disconnect();
      } catch (e) {
        console.error('Chart init error:', e);
      }
    };

    const cleanupPromise = init();
    return () => {
      cleanupPromise.then(fn => fn?.());
      markersPlugin?.detach?.();
      chart?.remove();
      chart = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, ohlcv, levels, signal]);

  return (
    <div className="relative w-full h-full min-h-[420px]">
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
