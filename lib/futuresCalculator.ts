export interface FuturesResult {
  positionSize: number;
  notionalValue: number;
  marginRequired: number;
  riskAmount: number;
  potentialProfit: number;
  potentialLoss: number;
  rrRatio: number;
  liquidationLong: number;
  liquidationShort: number;
  leverageWarning: boolean;
}

export function calculateFutures(
  entry: number,
  sl: number,
  tp3: number,
  leverage: number,
  accountBalance: number,
  riskPct = 0.02
): FuturesResult {
  const riskAmount    = accountBalance * riskPct;
  const riskPerUnit   = Math.abs(entry - sl);
  const positionSize  = riskPerUnit > 0 ? riskAmount / riskPerUnit : 0;
  const notionalValue = positionSize * entry;
  const marginReq     = leverage > 0 ? notionalValue / leverage : notionalValue;
  const liqLong       = entry * (1 - 1 / Math.max(leverage, 1));
  const liqShort      = entry * (1 + 1 / Math.max(leverage, 1));
  const potentialProfit = Math.abs(tp3 - entry) * positionSize;

  return {
    positionSize:    parseFloat(positionSize.toFixed(4)),
    notionalValue:   parseFloat(notionalValue.toFixed(2)),
    marginRequired:  parseFloat(marginReq.toFixed(2)),
    riskAmount:      parseFloat(riskAmount.toFixed(2)),
    potentialProfit: parseFloat(potentialProfit.toFixed(2)),
    potentialLoss:   parseFloat(riskAmount.toFixed(2)),
    rrRatio:         parseFloat((riskAmount > 0 ? potentialProfit / riskAmount : 0).toFixed(1)),
    liquidationLong: parseFloat(liqLong.toFixed(4)),
    liquidationShort:parseFloat(liqShort.toFixed(4)),
    leverageWarning: leverage > 10,
  };
}
