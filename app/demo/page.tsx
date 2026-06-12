'use client';
import { useState } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import DemoPortfolio from '@/components/demo/DemoPortfolio';
import DemoTradeForm from '@/components/demo/DemoTradeForm';
import OpenPositions from '@/components/demo/OpenPositions';
import TradeHistory from '@/components/demo/TradeHistory';
import TradeJournal from '@/components/demo/TradeJournal';
import PerformanceAnalysis from '@/components/demo/PerformanceAnalysis';
import DemoLeaderboard from '@/components/demo/DemoLeaderboard';

const TABS = [
  { id: 'portfolio', label: 'Portfolio' },
  { id: 'trade', label: 'New Trade' },
  { id: 'positions', label: 'Open Positions' },
  { id: 'history', label: 'Trade History' },
  { id: 'journal', label: 'Journal' },
  { id: 'analysis', label: 'Analysis' },
  { id: 'leaderboard', label: 'Leaderboard' },
] as const;

type TabId = typeof TABS[number]['id'];

export default function DemoPage() {
  const [activeTab, setActiveTab] = useState<TabId>('portfolio');

  return (
    <div className="flex min-h-screen bg-slate-950">
      <Sidebar />
      <div className="flex-1 min-w-0 text-white p-4 md:p-6 pt-16 lg:pt-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Demo Trading</h1>
          <p className="text-sm text-slate-400 mt-0.5">Paper trade with $10,000 virtual balance · No real money at risk</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs text-emerald-400 font-medium">Live prices</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'portfolio' && <DemoPortfolio />}
        {activeTab === 'trade' && (
          <div className="max-w-2xl">
            <DemoTradeForm />
          </div>
        )}
        {activeTab === 'positions' && (
          <div className="bg-slate-800/40 rounded-xl border border-white/5 p-4">
            <OpenPositions />
          </div>
        )}
        {activeTab === 'history' && (
          <div className="bg-slate-800/40 rounded-xl border border-white/5 p-4">
            <TradeHistory />
          </div>
        )}
        {activeTab === 'journal' && <TradeJournal />}
        {activeTab === 'analysis' && <PerformanceAnalysis />}
        {activeTab === 'leaderboard' && <DemoLeaderboard />}
      </div>
      </div>
    </div>
  );
}
