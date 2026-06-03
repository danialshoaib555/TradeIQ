'use client';
import { create } from 'zustand';
import type { SignalResult } from '@/lib/signalEngine';
import type { TradeLevels } from '@/lib/levelCalculator';
import type { Strategy } from '@/lib/strategyMatcher';

export interface PairSignal {
  pairId: string;
  pairName: string;
  market: string;
  signal: SignalResult;
  levels: TradeLevels | null;
  strategy: Strategy | null;
  price: number;
  updatedAt: number;
  loading: boolean;
  error: string | null;
}

interface SignalStore {
  signals: Record<string, PairSignal>;
  lastRefresh: number | null;
  setSignal: (pairId: string, data: Partial<PairSignal>) => void;
  setLastRefresh: (ts: number) => void;
}

export const useSignalStore = create<SignalStore>((set) => ({
  signals: {},
  lastRefresh: null,
  setSignal: (pairId, data) =>
    set(state => ({
      signals: { ...state.signals, [pairId]: { ...(state.signals[pairId] ?? {}), ...data } as PairSignal },
    })),
  setLastRefresh: (ts) => set({ lastRefresh: ts }),
}));
