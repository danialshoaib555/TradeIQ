'use client';
import { useState } from 'react';
import { useDemoStore } from '@/store/useDemoStore';

export default function TradeJournal() {
  const { journal, trades, addJournalNote } = useDemoStore();
  const [selectedTrade, setSelectedTrade] = useState('');
  const [noteText, setNoteText] = useState('');

  const closedTrades = trades.filter(t => t.status !== 'OPEN');

  const handleAdd = () => {
    if (!noteText.trim()) return;
    addJournalNote(selectedTrade || 'general', noteText.trim());
    setNoteText('');
  };

  const getTradeLabel = (tradeId: string) => {
    const t = trades.find(t => t.id === tradeId);
    return t ? `${t.pairName} ${t.direction}` : 'General';
  };

  return (
    <div className="space-y-4">
      {/* Add note */}
      <div className="bg-slate-800/40 rounded-xl border border-white/5 p-4 space-y-3">
        <p className="text-sm font-semibold text-white">Add Journal Note</p>
        <div className="grid grid-cols-3 gap-3">
          <select value={selectedTrade} onChange={e => setSelectedTrade(e.target.value)}
            className="col-span-1 bg-slate-900/60 border border-white/8 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-emerald-500/40">
            <option value="">General</option>
            {closedTrades.map(t => (
              <option key={t.id} value={t.id}>{t.pairName} {t.direction} {t.pnl >= 0 ? '+' : ''}${t.pnl.toFixed(0)}</option>
            ))}
          </select>
          <input value={noteText} onChange={e => setNoteText(e.target.value)}
            placeholder="Write your note…" onKeyDown={e => e.key === 'Enter' && handleAdd()}
            className="col-span-2 bg-slate-900/60 border border-white/8 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-emerald-500/40" />
        </div>
        <button onClick={handleAdd} disabled={!noteText.trim()}
          className="text-xs px-4 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 transition-all disabled:opacity-40">
          Add Note
        </button>
      </div>

      {/* Journal entries */}
      <div className="space-y-2 max-h-[500px] overflow-y-auto">
        {journal.length === 0 && (
          <p className="text-center text-slate-500 text-sm py-8">No journal entries yet</p>
        )}
        {journal.map(entry => (
          <div key={entry.id} className={`rounded-lg p-3 border text-sm ${
            entry.type === 'open' ? 'bg-sky-500/5 border-sky-500/15'
            : entry.type === 'close' ? (entry.content.includes('+') ? 'bg-emerald-500/5 border-emerald-500/15' : 'bg-red-500/5 border-red-500/15')
            : 'bg-slate-800/40 border-white/5'
          }`}>
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                entry.type === 'open' ? 'text-sky-400 bg-sky-500/10'
                : entry.type === 'close' ? 'text-slate-400 bg-slate-800'
                : 'text-amber-400 bg-amber-500/10'
              }`}>
                {entry.type === 'open' ? 'OPEN' : entry.type === 'close' ? 'CLOSE' : 'NOTE'}
              </span>
              {entry.tradeId !== 'general' && (
                <span className="text-xs text-slate-500">{getTradeLabel(entry.tradeId)}</span>
              )}
              <span className="ml-auto text-xs text-slate-600">
                {new Date(entry.timestamp).toLocaleString()}
              </span>
            </div>
            <p className="text-xs text-slate-300">{entry.content}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
