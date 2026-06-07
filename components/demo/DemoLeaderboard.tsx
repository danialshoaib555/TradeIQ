'use client';
import { useDemoStore } from '@/store/useDemoStore';
import { calcStats } from '@/lib/demo/performanceStats';

// Simulated global leaderboard entries
const SIMULATED_LEADERS = [
  { name: 'AlphaTrader', equity: 14280, winRate: 68.5, trades: 42, badge: '🥇' },
  { name: 'FxSurfer', equity: 13650, winRate: 61.2, trades: 67, badge: '🥈' },
  { name: 'CryptoHunter', equity: 12990, winRate: 55.8, trades: 31, badge: '🥉' },
  { name: 'PipMaster', equity: 12450, winRate: 58.3, trades: 89, badge: '' },
  { name: 'TrendRider', equity: 12100, winRate: 52.1, trades: 55, badge: '' },
  { name: 'BreakoutKing', equity: 11780, winRate: 49.7, trades: 23, badge: '' },
  { name: 'SwingPro', equity: 11340, winRate: 57.9, trades: 48, badge: '' },
  { name: 'ScalpBot99', equity: 10920, winRate: 46.3, trades: 112, badge: '' },
];

export default function DemoLeaderboard() {
  const { equity, trades } = useDemoStore();
  const stats = calcStats(trades);

  // Insert user into leaderboard
  const myEntry = {
    name: 'You',
    equity: Math.round(equity * 100) / 100,
    winRate: stats.winRate,
    trades: stats.totalTrades,
    badge: '',
    isMe: true,
  };

  const allEntries = [...SIMULATED_LEADERS.map(e => ({ ...e, isMe: false })), myEntry]
    .sort((a, b) => b.equity - a.equity)
    .map((e, i) => ({ ...e, rank: i + 1 }));

  const myRank = allEntries.findIndex(e => e.isMe) + 1;
  const totalReturn = ((equity - 10000) / 10000) * 100;

  return (
    <div className="space-y-4">
      {/* My rank summary */}
      <div className="bg-slate-800/40 rounded-xl border border-white/5 p-4 flex items-center gap-4">
        <div className="text-3xl font-bold text-white">#{myRank}</div>
        <div>
          <p className="text-sm font-semibold text-white">Your Ranking</p>
          <p className="text-xs text-slate-400">
            ${equity.toFixed(2)} equity · {totalReturn >= 0 ? '+' : ''}{totalReturn.toFixed(2)}% return · {stats.totalTrades} trades · {stats.winRate.toFixed(1)}% win rate
          </p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-xs text-slate-500">Starting balance</p>
          <p className="text-sm text-white font-mono">$10,000.00</p>
        </div>
      </div>

      {/* Leaderboard table */}
      <div className="bg-slate-800/40 rounded-xl border border-white/5 overflow-hidden">
        <div className="px-4 py-3 border-b border-white/5">
          <p className="text-xs font-semibold text-slate-400">Global Demo Leaderboard — $10K Starting Balance</p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-slate-500 border-b border-white/5">
              <th className="text-left px-4 py-2">Rank</th>
              <th className="text-left px-4 py-2">Trader</th>
              <th className="text-right px-4 py-2">Equity</th>
              <th className="text-right px-4 py-2">Return</th>
              <th className="text-right px-4 py-2">Win Rate</th>
              <th className="text-right px-4 py-2">Trades</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/3">
            {allEntries.map(entry => {
              const ret = ((entry.equity - 10000) / 10000) * 100;
              return (
                <tr key={entry.name}
                  className={`transition-colors ${entry.isMe ? 'bg-emerald-500/5 border border-emerald-500/15' : 'hover:bg-white/2'}`}>
                  <td className="px-4 py-2.5 text-sm font-bold text-slate-400">
                    {entry.badge || `#${entry.rank}`}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`font-medium text-sm ${entry.isMe ? 'text-emerald-400' : 'text-white'}`}>
                      {entry.name} {entry.isMe && '(you)'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-sm text-white">${entry.equity.toLocaleString()}</td>
                  <td className={`px-4 py-2.5 text-right font-mono text-sm font-bold ${ret >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {ret >= 0 ? '+' : ''}{ret.toFixed(1)}%
                  </td>
                  <td className="px-4 py-2.5 text-right text-sm text-slate-300">{entry.winRate.toFixed(1)}%</td>
                  <td className="px-4 py-2.5 text-right text-sm text-slate-500">{entry.trades}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="px-4 py-2 border-t border-white/5">
          <p className="text-xs text-slate-600 text-center">Simulated leaderboard · Rankings update with every trade</p>
        </div>
      </div>
    </div>
  );
}
