'use client';
import { create } from 'zustand';
import type { MarketFilter } from '@/lib/pairConfig';

interface PairStore {
  selectedPairId: string;
  selectedMarket: MarketFilter;
  selectedTimeframe: '5m' | '15m' | '1h' | '4h' | '1D';
  setSelectedPair: (id: string) => void;
  setMarket: (market: MarketFilter) => void;
  setTimeframe: (tf: PairStore['selectedTimeframe']) => void;
}

export const usePairStore = create<PairStore>((set) => ({
  selectedPairId: 'eurusd',
  selectedMarket: 'all',
  selectedTimeframe: '1h',
  setSelectedPair: (id) => set({ selectedPairId: id }),
  setMarket: (selectedMarket) => set({ selectedMarket }),
  setTimeframe: (selectedTimeframe) => set({ selectedTimeframe }),
}));
