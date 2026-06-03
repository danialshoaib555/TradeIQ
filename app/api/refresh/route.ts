import { NextResponse } from 'next/server';
import { PAIRS } from '@/lib/pairConfig';

export async function GET(req: Request) {
  const auth = req.headers.get('authorization');
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const base = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000';
  const results: string[] = [];
  for (const pair of PAIRS.slice(0, 10)) {
    try {
      await fetch(`${base}/api/ohlcv/${pair.id}?tf=1h`);
      results.push(`✓ ${pair.id}`);
    } catch {
      results.push(`✗ ${pair.id}`);
    }
  }
  return NextResponse.json({ refreshed: results, at: new Date().toISOString() });
}
