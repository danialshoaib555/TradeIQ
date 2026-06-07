// Accurate weekend-aware session + market hours

export interface TradingSession {
  name: string;
  open: number;
  close: number;
  color: string;
  isOpen?: boolean;
  displayHours: string;
  pairs: string[];
  alwaysOpen?: boolean;
}

export interface SessionQuality {
  name: string;
  quality: 'best' | 'good' | 'moderate' | 'poor';
  message: string;
  tradeable?: string[];
}

export const SESSIONS: TradingSession[] = [
  { name: 'Sydney',   open: 22, close: 7,  color: '#5DCAA5', displayHours: '22:00–07:00 UTC', pairs: ['AUD/USD','NZD/USD','AUD/JPY'] },
  { name: 'Tokyo',    open: 0,  close: 9,  color: '#E24B4A', displayHours: '00:00–09:00 UTC', pairs: ['USD/JPY','EUR/JPY','GBP/JPY'] },
  { name: 'London',   open: 8,  close: 17, color: '#378ADD', displayHours: '08:00–17:00 UTC', pairs: ['EUR/USD','GBP/USD','EUR/GBP'] },
  { name: 'New York', open: 13, close: 22, color: '#EF9F27', displayHours: '13:00–22:00 UTC', pairs: ['USD/CAD','USD/CHF','USD/JPY'] },
  { name: 'Crypto',   open: 0,  close: 24, color: '#7F77DD', displayHours: '24/7 — always',   pairs: ['BTC/USDT','ETH/USDT','SOL/USDT'], alwaysOpen: true },
];

function getUTCDecimal(): { day: number; hour: number; min: number; decimal: number } {
  const now = new Date();
  const day = now.getUTCDay();
  const hour = now.getUTCHours();
  const min  = now.getUTCMinutes();
  return { day, hour, min, decimal: hour + min / 60 };
}

export function getSessionStatus(): TradingSession[] {
  const { day, decimal } = getUTCDecimal();
  const isWeekend = day === 0 || day === 6;

  return SESSIONS.map(s => {
    let isOpen = false;
    if (s.alwaysOpen) {
      isOpen = true;
    } else if (isWeekend) {
      isOpen = false; // all forex sessions closed on weekends
    } else {
      // overnight sessions span midnight
      if (s.open > s.close) {
        isOpen = decimal >= s.open || decimal < s.close;
      } else {
        isOpen = decimal >= s.open && decimal < s.close;
      }
    }
    return { ...s, isOpen };
  });
}

export function getBestSession(): SessionQuality {
  const { day, hour, min, decimal } = getUTCDecimal();
  const isWeekend = day === 0 || day === 6;
  const isSaturday = day === 6;
  const isSunday   = day === 0;

  if (isSaturday) {
    return { name: 'Weekend — crypto only', quality: 'poor', message: 'Forex, stocks & commodities closed all day. Only crypto trades 24/7.', tradeable: ['BTC/USDT','ETH/USDT','SOL/USDT'] };
  }
  if (isSunday && hour < 22) {
    const minsLeft = (22 - hour) * 60 - min;
    const h = Math.floor(minsLeft / 60);
    const m = minsLeft % 60;
    return { name: 'Forex opens tonight', quality: 'poor', message: `Forex opens in ${h}h ${m}m (22:00 UTC). Only crypto tradeable now.`, tradeable: ['BTC/USDT','ETH/USDT'] };
  }

  const londonOpen = !isWeekend && decimal >= 8  && decimal < 17;
  const nyOpen     = !isWeekend && decimal >= 13 && decimal < 22;
  const tokyoOpen  = !isWeekend && decimal >= 0  && decimal < 9;
  const sydneyOpen = !isWeekend && (decimal >= 22 || decimal < 7);

  if (londonOpen && nyOpen) return { name: 'London + NY overlap', quality: 'best',     message: 'Peak liquidity 13:00–17:00 UTC — tightest spreads, strongest moves', tradeable: ['EUR/USD','GBP/USD','USD/JPY','Gold'] };
  if (londonOpen)           return { name: 'London session',       quality: 'good',     message: 'High liquidity. EUR/USD and GBP/USD most active.', tradeable: ['EUR/USD','GBP/USD','EUR/GBP'] };
  if (nyOpen)               return { name: 'New York session',     quality: 'good',     message: 'High liquidity. USD pairs and US stocks most active.', tradeable: ['USD/CAD','USD/CHF','Gold'] };
  if (tokyoOpen)            return { name: 'Tokyo session',        quality: 'moderate', message: 'Medium liquidity. JPY pairs most active.', tradeable: ['USD/JPY','EUR/JPY','AUD/USD'] };
  if (sydneyOpen)           return { name: 'Sydney session',       quality: 'moderate', message: 'Lower liquidity. AUD/NZD pairs most active.', tradeable: ['AUD/USD','NZD/USD','AUD/JPY'] };

  return { name: 'Low liquidity period', quality: 'poor', message: 'Avoid trading — wide spreads, low volume', tradeable: ['Crypto only'] };
}

export function isForexOpen(): boolean {
  const { day, decimal } = getUTCDecimal();
  if (day === 6) return false;                       // Saturday: closed
  if (day === 0 && decimal < 22) return false;       // Sunday before 22:00: closed
  if (day === 5 && decimal >= 22) return false;      // Friday after 22:00: closed
  return true;
}

export function isStocksOpen(): boolean {
  const { day, decimal } = getUTCDecimal();
  if (day === 0 || day === 6) return false;
  return decimal >= 13.5 && decimal < 20;
}
