'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type TradeDirection = 'LONG' | 'SHORT';
export type TradeStatus = 'OPEN' | 'CLOSED' | 'SL_HIT' | 'TP_HIT';
export type EmotionTag = 'disciplined' | 'confident' | 'fearful' | 'greedy' | 'neutral';

export interface DemoTrade {
  id: string;
  pairId: string;
  pairName: string;
  direction: TradeDirection;
  entryPrice: number;
  exitPrice?: number;
  sl: number;
  tp: number;
  lotSize: number;
  units: number;
  openTime: number;
  closeTime?: number;
  status: TradeStatus;
  pnl: number;
  pnlPct: number;
  emotion?: EmotionTag;
  note?: string;
  strategy?: string;
  riskAmount: number;
  riskReward: number;
  pipSize: number;
  market: string;
}

export interface JournalEntry {
  id: string;
  tradeId: string;
  timestamp: number;
  type: 'open' | 'close' | 'note';
  content: string;
  auto: boolean;
}

interface DemoStore {
  balance: number;
  equity: number;
  trades: DemoTrade[];
  journal: JournalEntry[];
  equityCurve: { time: number; equity: number }[];
  openTrade: (trade: Omit<DemoTrade, 'id' | 'openTime' | 'status' | 'pnl' | 'pnlPct'>) => string;
  closeTrade: (id: string, exitPrice: number, status?: TradeStatus) => void;
  updateOpenPnl: (id: string, currentPrice: number) => void;
  addJournalNote: (tradeId: string, content: string) => void;
  resetAccount: () => void;
  removeClosedTrade: (id: string) => void;
}

const STARTING_BALANCE = 10_000;

export const useDemoStore = create<DemoStore>()(
  persist(
    (set, get) => ({
      balance: STARTING_BALANCE,
      equity: STARTING_BALANCE,
      trades: [],
      journal: [],
      equityCurve: [{ time: Date.now(), equity: STARTING_BALANCE }],

      openTrade: (tradeData) => {
        const id = `trade_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const trade: DemoTrade = {
          ...tradeData,
          id,
          openTime: Date.now(),
          status: 'OPEN',
          pnl: 0,
          pnlPct: 0,
        };
        const journalEntry: JournalEntry = {
          id: `j_${Date.now()}`,
          tradeId: id,
          timestamp: Date.now(),
          type: 'open',
          content: `Opened ${trade.direction} ${trade.pairName} @ ${trade.entryPrice.toFixed(5)} | SL: ${trade.sl.toFixed(5)} | TP: ${trade.tp.toFixed(5)} | Risk: $${trade.riskAmount.toFixed(2)} | R:R 1:${trade.riskReward.toFixed(1)}`,
          auto: true,
        };
        set(s => ({
          trades: [trade, ...s.trades],
          journal: [journalEntry, ...s.journal],
          balance: s.balance - trade.riskAmount,
        }));
        return id;
      },

      closeTrade: (id, exitPrice, status = 'CLOSED') => {
        const s = get();
        const trade = s.trades.find(t => t.id === id);
        if (!trade || trade.status !== 'OPEN') return;

        const priceDiff = trade.direction === 'LONG'
          ? exitPrice - trade.entryPrice
          : trade.entryPrice - exitPrice;
        const pips = priceDiff / trade.pipSize;
        const pnl = pips * trade.pipSize * trade.units * (trade.market === 'crypto' ? exitPrice : 1);
        const pnlPct = (pnl / STARTING_BALANCE) * 100;
        const newBalance = s.balance + trade.riskAmount + pnl;
        const newEquity = newBalance;

        const closedTrade: DemoTrade = {
          ...trade,
          exitPrice,
          closeTime: Date.now(),
          status,
          pnl: Math.round(pnl * 100) / 100,
          pnlPct: Math.round(pnlPct * 100) / 100,
        };

        const resultStr = pnl >= 0 ? `+$${pnl.toFixed(2)}` : `-$${Math.abs(pnl).toFixed(2)}`;
        const reason = status === 'SL_HIT' ? 'Stop Loss hit' : status === 'TP_HIT' ? 'Take Profit hit' : 'Manually closed';
        const journalEntry: JournalEntry = {
          id: `j_${Date.now()}`,
          tradeId: id,
          timestamp: Date.now(),
          type: 'close',
          content: `${reason} — ${trade.pairName} ${trade.direction} closed @ ${exitPrice.toFixed(5)} | P&L: ${resultStr} (${pnlPct.toFixed(2)}%)`,
          auto: true,
        };

        const equityPoint = { time: Date.now(), equity: newEquity };

        set(st => ({
          trades: st.trades.map(t => t.id === id ? closedTrade : t),
          journal: [journalEntry, ...st.journal],
          balance: newBalance,
          equity: newEquity,
          equityCurve: [...st.equityCurve, equityPoint],
        }));
      },

      updateOpenPnl: (id, currentPrice) => {
        const s = get();
        const trade = s.trades.find(t => t.id === id && t.status === 'OPEN');
        if (!trade) return;

        // Check SL/TP
        if (trade.direction === 'LONG') {
          if (currentPrice <= trade.sl) { get().closeTrade(id, trade.sl, 'SL_HIT'); return; }
          if (currentPrice >= trade.tp) { get().closeTrade(id, trade.tp, 'TP_HIT'); return; }
        } else {
          if (currentPrice >= trade.sl) { get().closeTrade(id, trade.sl, 'SL_HIT'); return; }
          if (currentPrice <= trade.tp) { get().closeTrade(id, trade.tp, 'TP_HIT'); return; }
        }

        const priceDiff = trade.direction === 'LONG'
          ? currentPrice - trade.entryPrice
          : trade.entryPrice - currentPrice;
        const pips = priceDiff / trade.pipSize;
        const pnl = pips * trade.pipSize * trade.units * (trade.market === 'crypto' ? currentPrice : 1);

        set(st => {
          const openPnl = st.trades
            .filter(t => t.status === 'OPEN')
            .reduce((sum, t) => sum + (t.id === id ? pnl : t.pnl), 0);
          return {
            trades: st.trades.map(t => t.id === id ? { ...t, pnl: Math.round(pnl * 100) / 100 } : t),
            equity: st.balance + openPnl,
          };
        });
      },

      addJournalNote: (tradeId, content) => {
        const entry: JournalEntry = {
          id: `j_${Date.now()}`,
          tradeId,
          timestamp: Date.now(),
          type: 'note',
          content,
          auto: false,
        };
        set(s => ({ journal: [entry, ...s.journal] }));
      },

      resetAccount: () => {
        set({
          balance: STARTING_BALANCE,
          equity: STARTING_BALANCE,
          trades: [],
          journal: [],
          equityCurve: [{ time: Date.now(), equity: STARTING_BALANCE }],
        });
      },

      removeClosedTrade: (id) => {
        set(s => ({ trades: s.trades.filter(t => t.id !== id) }));
      },
    }),
    { name: 'tradeiq-demo-v1' }
  )
);
