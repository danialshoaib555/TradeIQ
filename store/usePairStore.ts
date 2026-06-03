'use client';
import { create } from 'zustand';

interface PairStore {
  selectedPairId: string;
  selectedMarket: 'all' | 'forex' | 'crypto' | 'stocks' | 'commodities';
  selectedTimeframe: '5m' | '15m' | '1h' | '4h' | '1D';
  tradeType: 'spot' | 'long' | 'short';
  setSelectedPair: (id: string) => void;
  setMarket: (market: PairStore['selectedMarket']) => void;
  setTimeframe: (tf: PairStore['selectedTimeframe']) => void;
  setTradeType: (tt: PairStore['tradeType']) => void;
}

export const usePairStore = create<PairStore>((set) => ({
  selectedPairId: 'eurusd',
  selectedMarket: 'all',
  selectedTimeframe: '1h',
  tradeType: 'spot',
  setSelectedPair: (id) => set({ selectedPairId: id }),
  setMarket: (selectedMarket) => set({ selectedMarket }),
  setTimeframe: (selectedTimeframe) => set({ selectedTimeframe }),
  setTradeType: (tradeType) => set({ tradeType }),
}));
