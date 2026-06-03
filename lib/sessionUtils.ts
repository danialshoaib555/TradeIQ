export interface TradingSession {
  name: string;
  open: number;
  close: number;
  color: string;
  isOpen?: boolean;
}

export const SESSIONS: TradingSession[] = [
  { name: 'Sydney',   open: 22, close: 7,  color: '#5DCAA5' },
  { name: 'Tokyo',    open: 0,  close: 9,  color: '#378ADD' },
  { name: 'London',   open: 8,  close: 17, color: '#7F77DD' },
  { name: 'New York', open: 13, close: 22, color: '#D85A30' },
];

export function getSessionStatus(): TradingSession[] {
  const now = new Date();
  const utcHour = now.getUTCHours() + now.getUTCMinutes() / 60;
  return SESSIONS.map(s => {
    const isOpen = s.open > s.close
      ? utcHour >= s.open || utcHour < s.close
      : utcHour >= s.open && utcHour < s.close;
    return { ...s, isOpen };
  });
}

export interface SessionQuality {
  name: string;
  quality: 'best' | 'good' | 'poor';
  message: string;
}

export function getBestSession(): SessionQuality {
  const status = getSessionStatus();
  const londonOpen = status.find(s => s.name === 'London')?.isOpen;
  const nyOpen     = status.find(s => s.name === 'New York')?.isOpen;
  if (londonOpen && nyOpen) return { name: 'London + NY overlap', quality: 'best', message: 'Highest liquidity — best time to trade' };
  if (londonOpen)           return { name: 'London session', quality: 'good', message: 'High liquidity — good for forex' };
  if (nyOpen)               return { name: 'New York session', quality: 'good', message: 'High liquidity — good for stocks + forex' };
  return { name: 'Low liquidity period', quality: 'poor', message: 'Avoid trading — wide spreads, low volume' };
}
