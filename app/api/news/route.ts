import { NextResponse } from 'next/server';

export interface NewsItem {
  id: string;
  title: string;
  source: string;
  publishedAt: string;
  url: string;
  category: string;
  body?: string;
}

function parseRSSItems(xml: string, defaultSource: string): NewsItem[] {
  const items: NewsItem[] = [];
  const itemRx = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = itemRx.exec(xml)) !== null) {
    const block = m[1];
    const title = (block.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/)?.[1] ?? '').trim();
    const link  = (block.match(/<link>([\s\S]*?)<\/link>/)?.[1] ?? '#').trim();
    const date  = (block.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] ?? '').trim();
    const src   = (block.match(/<source[^>]*>([\s\S]*?)<\/source>/)?.[1] ?? defaultSource).trim();
    if (title && title.length > 5) {
      items.push({ id: link, title, source: src || defaultSource, publishedAt: date || new Date().toISOString(), url: link, category: 'general' });
    }
  }
  return items;
}

async function fetchCryptoCompareNews(): Promise<NewsItem[]> {
  try {
    const res = await fetch('https://min-api.cryptocompare.com/data/v2/news/?lang=EN&sortOrder=latest&limit=20', {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      next: { revalidate: 120 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data.Data ?? []).map((n: any) => ({
      id: String(n.id),
      title: n.title,
      source: n.source_info?.name ?? n.source ?? 'CryptoCompare',
      publishedAt: new Date(n.published_on * 1000).toISOString(),
      url: n.url,
      category: 'crypto',
      body: n.body?.slice(0, 200),
    }));
  } catch { return []; }
}

async function fetchYahooRSS(): Promise<NewsItem[]> {
  try {
    const res = await fetch('https://feeds.finance.yahoo.com/rss/2.0/headline?s=%5EGSPC,%5EIXIC&region=US&lang=en-US', {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      next: { revalidate: 300 },
    });
    if (!res.ok) return [];
    const xml = await res.text();
    return parseRSSItems(xml, 'Yahoo Finance').slice(0, 10);
  } catch { return []; }
}

async function fetchInvestingRSS(): Promise<NewsItem[]> {
  try {
    const res = await fetch('https://www.reutersagency.com/feed/?best-topics=business-finance&post_type=best', {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      next: { revalidate: 300 },
    });
    if (!res.ok) return [];
    const xml = await res.text();
    return parseRSSItems(xml, 'Reuters').map(i => ({ ...i, category: 'general' })).slice(0, 8);
  } catch { return []; }
}

const FALLBACK: NewsItem[] = [
  { id: '1', title: 'Federal Reserve signals patient approach to rate policy', source: 'Reuters', publishedAt: new Date().toISOString(), url: '#', category: 'general' },
  { id: '2', title: 'Bitcoin ETF inflows reach new monthly record as institutional demand grows', source: 'CoinDesk', publishedAt: new Date().toISOString(), url: '#', category: 'crypto' },
  { id: '3', title: 'Dollar weakens ahead of key inflation data release', source: 'Bloomberg', publishedAt: new Date().toISOString(), url: '#', category: 'forex' },
  { id: '4', title: 'S&P 500 hovers near all-time highs as earnings season begins', source: 'CNBC', publishedAt: new Date().toISOString(), url: '#', category: 'stocks' },
  { id: '5', title: 'Gold hits $2,400 on safe-haven demand amid geopolitical tensions', source: 'Reuters', publishedAt: new Date().toISOString(), url: '#', category: 'commodities' },
  { id: '6', title: 'Oil prices steady as OPEC+ maintains production cut agreement', source: 'Bloomberg', publishedAt: new Date().toISOString(), url: '#', category: 'commodities' },
  { id: '7', title: 'Tech stocks rally led by AI chip demand — NVDA up 4%', source: 'CNBC', publishedAt: new Date().toISOString(), url: '#', category: 'stocks' },
  { id: '8', title: 'EUR/USD holds above 1.08 on ECB rate expectations', source: 'FX Street', publishedAt: new Date().toISOString(), url: '#', category: 'forex' },
];

export async function GET() {
  const [crypto, yahoo, investing] = await Promise.allSettled([
    fetchCryptoCompareNews(),
    fetchYahooRSS(),
    fetchInvestingRSS(),
  ]);

  const combined = [
    ...(crypto.status === 'fulfilled' ? crypto.value : []),
    ...(yahoo.status === 'fulfilled' ? yahoo.value : []),
    ...(investing.status === 'fulfilled' ? investing.value : []),
  ];

  if (combined.length === 0) {
    return NextResponse.json(FALLBACK, {
      headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=240' },
    });
  }

  // Deduplicate by title similarity & sort by date
  const seen = new Set<string>();
  const deduped = combined.filter(item => {
    const key = item.title.slice(0, 40).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  deduped.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

  return NextResponse.json(deduped.slice(0, 30), {
    headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=240' },
  });
}
