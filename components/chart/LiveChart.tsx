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
  const [chartMounted, setChartMounted] = useState(false);

  useEffect(() => {
    setReady(false);
    setChartMounted(false);
    fetch(`/api/ohlcv/${pairId}?tf=${timeframe}`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setOhlcv(data);
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, [pairId, timeframe]);

  useEffect(() => {
    if (!ready || !containerRef.current || ohlcv.length === 0) return;

    let chart: { remove: () => void; timeScale: () => { fitContent: () => void }; addCandlestickSeries: (opts: unknown) => { setData: (d: unknown[]) => void; createPriceLine: (opts: unknown) => void; setMarkers: (m: unknown[]) => void } } | null = null;

    const init = async () => {
      try {
        const LWC = await import('lightweight-charts');
        if (!containerRef.current) return;

        chart = ((LWC as unknown) as { createChart: (el: HTMLElement, opts: unknown) => typeof chart }).createChart(containerRef.current, {
          layout: { background: { color: 'transparent' }, textColor: '#94A3B8' },
          grid: { vertLines: { color: 'rgba(255,255,255,0.03)' }, horzLines: { color: 'rgba(255,255,255,0.03)' } },
          rightPriceScale: { borderColor: 'rgba(255,255,255,0.08)' },
          timeScale: { borderColor: 'rgba(255,255,255,0.08)', timeVisible: true, secondsVisible: false },
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight || 400,
        });

        if (!chart) return;

        const candles = chart.addCandlestickSeries({
          upColor: '#22C55E', downColor: '#EF4444',
          borderUpColor: '#22C55E', borderDownColor: '#EF4444',
          wickUpColor: '#22C55E', wickDownColor: '#EF4444',
        });

        const sorted = [...ohlcv].sort((a, b) => a.time - b.time);
        candles.setData(sorted as unknown[]);

        if (levels && signal && signal.signal !== 'WAIT') {
          const sig = signal;
          const line = (price: number, color: string, title: string) =>
            candles.createPriceLine({ price, color, lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title });
          line(levels.entry, '#60A5FA', 'Entry');
          line(levels.sl,    '#EF4444', 'SL');
          line(levels.tp1,   '#4ADE80', 'TP1');
          line(levels.tp2,   '#22C55E', 'TP2');
          line(levels.tp3,   '#16A34A', 'TP3');

          const last = sorted.at(-1);
          if (last) {
            candles.setMarkers([{
              time: last.time,
              position: sig.signal === 'BUY' ? 'belowBar' : 'aboveBar',
              color: sig.signal === 'BUY' ? '#22C55E' : '#EF4444',
              shape: sig.signal === 'BUY' ? 'arrowUp' : 'arrowDown',
              text: sig.signal,
            }]);
          }
        }

        chart.timeScale().fitContent();
        setChartMounted(true);

        const ro = new ResizeObserver(() => {
          if (containerRef.current && chart) {
            (chart as { resize?: (w: number, h: number) => void }).resize?.(
              containerRef.current.clientWidth,
              containerRef.current.clientHeight || 400
            );
          }
        });
        if (containerRef.current) ro.observe(containerRef.current);

        return () => ro.disconnect();
      } catch (e) {
        console.error('Chart init error:', e);
      }
    };

    const cleanup = init();
    return () => {
      cleanup.then(fn => fn?.());
      chart?.remove();
    };
  }, [ready, ohlcv, levels, signal]);

  return (
    <div className="relative w-full h-full min-h-[400px]">
      <div ref={containerRef} className="w-full h-full" />
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 rounded-xl z-10">
          <div className="flex items-center gap-2 text-slate-400">
            <div className="w-5 h-5 border-2 border-slate-500 border-t-emerald-400 rounded-full animate-spin" />
            Loading chart...
          </div>
        </div>
      )}
      {ready && ohlcv.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-slate-500">
          No data available for this pair
        </div>
      )}
    </div>
  );
}
