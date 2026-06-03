import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const res = await fetch('https://nfs.faireconomy.media/ff_calendar_thisweek.xml', { next: { revalidate: 900 } });
    if (!res.ok) throw new Error('RSS failed');
    const xml = await res.text();
    const items: Array<{ title: string; currency: string; date: string; impact: string; forecast: string; previous: string }> = [];
    const re = /<event>([\s\S]*?)<\/event>/g;
    let m;
    while ((m = re.exec(xml)) !== null) {
      const b = m[1];
      const get = (tag: string) => { const x = b.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`)); return x ? x[1].replace(/<[^>]+>/g, '').trim() : ''; };
      items.push({ title: get('title'), currency: get('country'), date: get('date') || get('pubDate'), impact: get('impact') || 'Low', forecast: get('forecast'), previous: get('previous') });
    }
    return NextResponse.json(items, { headers: { 'Cache-Control': 'public, s-maxage=900' } });
  } catch {
    return NextResponse.json([]);
  }
}
