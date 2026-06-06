'use client';
import { useEffect, useState, useCallback } from 'react';
import type { NewsItem } from '@/app/api/news/route';

const CAT_COLOR: Record<string, string> = {
  crypto:      'text-orange-400 bg-orange-500/10 border-orange-500/20',
  forex:       'text-blue-400 bg-blue-500/10 border-blue-500/20',
  stocks:      'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  commodities: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  general:     'text-slate-400 bg-slate-500/10 border-slate-500/20',
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function NewsPanel() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchNews = useCallback(async () => {
    try {
      const res = await fetch('/api/news');
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        setNews(data);
        setLastUpdate(new Date());
      }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchNews();
    const id = setInterval(fetchNews, 2 * 60 * 1000); // refresh every 2 min
    return () => clearInterval(id);
  }, [fetchNews]);

  const cats = ['all', 'crypto', 'forex', 'stocks', 'commodities'];
  const displayed = filter === 'all' ? news : news.filter(n => n.category === filter);

  return (
    <div className="bg-white/2 border border-white/8 rounded-2xl overflow-hidden flex flex-col h-full">
      {/* Header */}
      <div className="px-5 py-4 border-b border-white/5 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <h3 className="font-semibold text-white text-sm">Market News</h3>
            {lastUpdate && (
              <span className="text-xs text-slate-600">· {lastUpdate.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</span>
            )}
          </div>
          <button onClick={fetchNews} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors text-slate-500 hover:text-slate-300 cursor-pointer" title="Refresh">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
        {/* Category filter */}
        <div className="flex gap-1 flex-wrap">
          {cats.map(c => (
            <button key={c} onClick={() => setFilter(c)}
              className={`px-2 py-0.5 rounded text-xs capitalize cursor-pointer transition-all duration-150 border ${
                filter === c
                  ? 'bg-white/10 text-white border-white/15'
                  : 'text-slate-500 border-transparent hover:text-slate-300'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* News list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="space-y-1.5">
                <div className="h-3 bg-white/5 rounded animate-pulse w-full" />
                <div className="h-3 bg-white/5 rounded animate-pulse w-3/4" />
                <div className="h-2 bg-white/3 rounded animate-pulse w-1/4" />
              </div>
            ))}
          </div>
        ) : displayed.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-slate-500 text-sm">No news available</div>
        ) : (
          <div className="divide-y divide-white/3">
            {displayed.map((item, i) => (
              <a
                key={item.id || i}
                href={item.url !== '#' ? item.url : undefined}
                target={item.url !== '#' ? '_blank' : undefined}
                rel="noopener noreferrer"
                className={`block px-4 py-3 hover:bg-white/3 transition-colors duration-100 ${item.url !== '#' ? 'cursor-pointer' : 'cursor-default'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm text-slate-200 leading-snug line-clamp-2 flex-1 min-w-0">{item.title}</p>
                  {item.url !== '#' && (
                    <svg className="w-3 h-3 text-slate-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className={`px-1.5 py-0.5 rounded text-xs border capitalize ${CAT_COLOR[item.category] ?? CAT_COLOR.general}`}>
                    {item.category}
                  </span>
                  <span className="text-xs text-slate-600">{item.source}</span>
                  <span className="text-xs text-slate-700 ml-auto">{timeAgo(item.publishedAt)}</span>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
