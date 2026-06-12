'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface WhaleMove {
  id: string;
  type: 'buy' | 'sell' | 'transfer';
  symbol: string;
  usd: number;
  usdDisplay: string;
  qty: string;
  exchange: string;
  wallet?: string;
  txHash?: string;
  time: number; // ms epoch — serializable for persistence
  tag: 'mega' | 'whale' | 'large';
}

export interface CoinStat {
  symbol: string;
  buy: number;
  sell: number;
  transfer: number;
  count: number;
  lastMove: 'buy' | 'sell' | 'transfer' | null;
  lastUsd: number;
  lastTs: number;
}

interface WhaleStore {
  moves: WhaleMove[];
  coinStats: Record<string, CoinStat>;
  totalVol: number;        // accumulated across visits
  startedAt: number;       // when accumulation began
  connected: Record<string, boolean>;  // not persisted
  flash: Record<string, 'buy' | 'sell' | null>; // not persisted

  pushMove: (m: WhaleMove) => void;
  bumpStat: (symbol: string, usd: number, type: 'buy' | 'sell' | 'transfer') => void;
  setConnected: (name: string, ok: boolean) => void;
  setFlash: (symbol: string, f: 'buy' | 'sell' | null) => void;
  resetStats: () => void;
}

export const useWhaleStore = create<WhaleStore>()(
  persist(
    (set) => ({
      moves: [],
      coinStats: {},
      totalVol: 0,
      startedAt: Date.now(),
      connected: {},
      flash: {},

      pushMove: (m) => set(s => ({
        moves: [m, ...s.moves].slice(0, 100),
        totalVol: s.totalVol + m.usd,
      })),

      bumpStat: (symbol, usd, type) => set(s => {
        const c = s.coinStats[symbol] ?? { symbol, buy: 0, sell: 0, transfer: 0, count: 0, lastMove: null, lastUsd: 0, lastTs: 0 };
        return {
          coinStats: {
            ...s.coinStats,
            [symbol]: {
              ...c,
              buy:      type === 'buy'      ? c.buy + usd      : c.buy,
              sell:     type === 'sell'     ? c.sell + usd     : c.sell,
              transfer: type === 'transfer' ? c.transfer + usd : c.transfer,
              count: c.count + 1,
              lastMove: type,
              lastUsd: usd,
              lastTs: Date.now(),
            },
          },
        };
      }),

      setConnected: (name, ok) => set(s => ({ connected: { ...s.connected, [name]: ok } })),
      setFlash: (symbol, f) => set(s => ({ flash: { ...s.flash, [symbol]: f } })),

      resetStats: () => set({
        moves: [], coinStats: {}, totalVol: 0, startedAt: Date.now(),
      }),
    }),
    {
      name: 'tradeiq-whales-v1',
      partialize: (s) => ({
        moves: s.moves.slice(0, 60),
        coinStats: s.coinStats,
        totalVol: s.totalVol,
        startedAt: s.startedAt,
      }),
    }
  )
);
