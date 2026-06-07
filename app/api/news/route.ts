import { NextResponse } from 'next/server';

export interface NewsItem {
  id: string;
  title: string;
  source: string;
  publishedAt: string;
  url: string;
  category: 'crypto' | 'forex' | 'stocks' | 'indices' | 'commodities' | 'general';
  body?: string;
}

function parseRSS(xml: string, defaultSource: string, category: NewsItem['category']): NewsItem[] {
  const items: NewsItem[] = [];
  const rx = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = rx.exec(xml)) !== null) {
    const b = m[1];
    const title = (b.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/)?.[1] ?? '').trim();
    const link  = (b.match(/<link>([\s\S]*?)<\/link>/)?.[1] ?? '').trim() ||
                  (b.match(/<guid[^>]*>([\s\S]*?)<\/guid>/)?.[1] ?? '#').trim();
    const date  = (b.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] ??
                   b.match(/<dc:date>([\s\S]*?)<\/dc:date>/)?.[1] ?? '').trim();
    const src   = (b.match(/<source[^>]*>([\s\S]*?)<\/source>/)?.[1] ?? defaultSource).trim();
    const desc  = (b.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/)?.[1] ?? '').replace(/<[^>]+>/g, '').trim().slice(0, 200);
    if (title && title.length > 5) {
      items.push({ id: link || title, title, source: src || defaultSource, publishedAt: date ? new Date(date).toISOString() : new Date().toISOString(), url: link || '#', category, body: desc || undefined });
    }
  }
  return items;
}

async function safeFetch(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TradeIQ/1.0)' }, next: { revalidate: 120 }, signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    return await res.text();
  } catch { return null; }
}

// ── Crypto ────────────────────────────────────────────────────────────────
async function fetchCryptoCompare(): Promise<NewsItem[]> {
  try {
    const res = await fetch('https://min-api.cryptocompare.com/data/v2/news/?lang=EN&sortOrder=latest&limit=25', { headers: { 'User-Agent': 'Mozilla/5.0' }, next: { revalidate: 120 } });
    if (!res.ok) return [];
    const data = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data.Data ?? []).map((n: any) => ({
      id: String(n.id), title: n.title,
      source: n.source_info?.name ?? n.source ?? 'CryptoCompare',
      publishedAt: new Date(n.published_on * 1000).toISOString(),
      url: n.url, category: 'crypto' as const, body: n.body?.slice(0, 200),
    }));
  } catch { return []; }
}

async function fetchCoinDeskRSS(): Promise<NewsItem[]> {
  const xml = await safeFetch('https://www.coindesk.com/arc/outboundfeeds/rss/?outputType=xml');
  return xml ? parseRSS(xml, 'CoinDesk', 'crypto').slice(0, 8) : [];
}

async function fetchCryptoBriefing(): Promise<NewsItem[]> {
  const xml = await safeFetch('https://cryptobriefing.com/feed/');
  return xml ? parseRSS(xml, 'Crypto Briefing', 'crypto').slice(0, 6) : [];
}

// ── Forex ─────────────────────────────────────────────────────────────────
async function fetchFXStreet(): Promise<NewsItem[]> {
  const xml = await safeFetch('https://www.fxstreet.com/rss/news');
  return xml ? parseRSS(xml, 'FX Street', 'forex').slice(0, 8) : [];
}

async function fetchForexLive(): Promise<NewsItem[]> {
  const xml = await safeFetch('https://www.forexlive.com/feed/news');
  return xml ? parseRSS(xml, 'Forex Live', 'forex').slice(0, 8) : [];
}

async function fetchDailyFX(): Promise<NewsItem[]> {
  const xml = await safeFetch('https://www.dailyfx.com/feeds/all');
  return xml ? parseRSS(xml, 'DailyFX', 'forex').slice(0, 6) : [];
}

// ── Stocks & Indices ──────────────────────────────────────────────────────
async function fetchYahooFinance(): Promise<NewsItem[]> {
  const xml = await safeFetch('https://feeds.finance.yahoo.com/rss/2.0/headline?s=%5EGSPC,%5EIXIC,AAPL,MSFT,NVDA&region=US&lang=en-US');
  return xml ? parseRSS(xml, 'Yahoo Finance', 'stocks').slice(0, 8) : [];
}

async function fetchSeekingAlpha(): Promise<NewsItem[]> {
  const xml = await safeFetch('https://seekingalpha.com/market_currents.xml');
  return xml ? parseRSS(xml, 'Seeking Alpha', 'stocks').slice(0, 6) : [];
}

async function fetchMarketWatch(): Promise<NewsItem[]> {
  const xml = await safeFetch('https://feeds.marketwatch.com/marketwatch/topstories/');
  return xml ? parseRSS(xml, 'MarketWatch', 'stocks').slice(0, 6) : [];
}

// ── Commodities ───────────────────────────────────────────────────────────
async function fetchOilPrice(): Promise<NewsItem[]> {
  const xml = await safeFetch('https://oilprice.com/rss/main');
  return xml ? parseRSS(xml, 'OilPrice.com', 'commodities').slice(0, 6) : [];
}

async function fetchKitco(): Promise<NewsItem[]> {
  const xml = await safeFetch('https://www.kitco.com/rss/kitconews.rss');
  return xml ? parseRSS(xml, 'Kitco', 'commodities').slice(0, 6) : [];
}

// ── General / Macro ───────────────────────────────────────────────────────
async function fetchReuters(): Promise<NewsItem[]> {
  const xml = await safeFetch('https://feeds.reuters.com/reuters/businessNews');
  if (xml) return parseRSS(xml, 'Reuters', 'general').slice(0, 6);
  // fallback Reuters URL
  const xml2 = await safeFetch('https://www.reutersagency.com/feed/?best-topics=business-finance&post_type=best');
  return xml2 ? parseRSS(xml2, 'Reuters', 'general').slice(0, 6) : [];
}

async function fetchBBC(): Promise<NewsItem[]> {
  const xml = await safeFetch('https://feeds.bbci.co.uk/news/business/rss.xml');
  return xml ? parseRSS(xml, 'BBC Business', 'general').slice(0, 5) : [];
}

const FALLBACK: NewsItem[] = [
  { id: '1', title: 'Federal Reserve signals patient approach to rate policy', source: 'Reuters', publishedAt: new Date().toISOString(), url: '#', category: 'general' },
  { id: '2', title: 'Bitcoin holds above $60K as institutional demand grows', source: 'CoinDesk', publishedAt: new Date().toISOString(), url: '#', category: 'crypto' },
  { id: '3', title: 'Dollar weakens ahead of key inflation data release', source: 'FX Street', publishedAt: new Date().toISOString(), url: '#', category: 'forex' },
  { id: '4', title: 'S&P 500 hovers near all-time highs as earnings season begins', source: 'MarketWatch', publishedAt: new Date().toISOString(), url: '#', category: 'stocks' },
  { id: '5', title: 'Gold hits $2,400 on safe-haven demand amid geopolitical tensions', source: 'Kitco', publishedAt: new Date().toISOString(), url: '#', category: 'commodities' },
  { id: '6', title: 'Oil prices steady as OPEC+ maintains production cuts', source: 'OilPrice.com', publishedAt: new Date().toISOString(), url: '#', category: 'commodities' },
  { id: '7', title: 'EUR/USD holds above 1.08 on ECB rate expectations', source: 'DailyFX', publishedAt: new Date().toISOString(), url: '#', category: 'forex' },
  { id: '8', title: 'Ethereum ETF sees record inflows as DeFi activity surges', source: 'CryptoCompare', publishedAt: new Date().toISOString(), url: '#', category: 'crypto' },
];

export async function GET() {
  const results = await Promise.allSettled([
    fetchCryptoCompare(),
    fetchCoinDeskRSS(),
    fetchCryptoBriefing(),
    fetchFXStreet(),
    fetchForexLive(),
    fetchDailyFX(),
    fetchYahooFinance(),
    fetchSeekingAlpha(),
    fetchMarketWatch(),
    fetchOilPrice(),
    fetchKitco(),
    fetchReuters(),
    fetchBBC(),
  ]);

  const combined: NewsItem[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled') combined.push(...r.value);
  }

  if (combined.length < 5) {
    return NextResponse.json(FALLBACK, {
      headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=240' },
    });
  }

  // Deduplicate by title
  const seen = new Set<string>();
  const deduped = combined.filter(item => {
    const key = item.title.slice(0, 50).toLowerCase().replace(/[^a-z0-9]/g, '');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  deduped.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

  return NextResponse.json(deduped.slice(0, 50), {
    headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=240' },
  });
}
