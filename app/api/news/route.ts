import { NextResponse } from 'next/server';

export async function GET() {
  const key = process.env.NEXT_PUBLIC_NEWS_API_KEY;
  if (!key) {
    return NextResponse.json([
      { title: 'Markets in focus as traders await key economic data', source: 'Reuters', publishedAt: new Date().toISOString(), url: '#' },
      { title: 'Central banks signal cautious approach to rate decisions', source: 'Bloomberg', publishedAt: new Date().toISOString(), url: '#' },
      { title: 'Crypto markets show resilience amid macro uncertainty', source: 'CoinDesk', publishedAt: new Date().toISOString(), url: '#' },
    ]);
  }
  try {
    const res = await fetch(`https://newsapi.org/v2/top-headlines?category=business&language=en&pageSize=10&apiKey=${key}`, { next: { revalidate: 600 } });
    const data = await res.json();
    return NextResponse.json((data.articles ?? []).map((a: { title: string; source: { name: string }; publishedAt: string; url: string }) => ({ title: a.title, source: a.source?.name, publishedAt: a.publishedAt, url: a.url })));
  } catch {
    return NextResponse.json([]);
  }
}
