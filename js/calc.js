// Pure formulas shared by the calculator tab and the generated questions.
// All are simplified textbook versions; exchanges add fees, tiered margin and liquidation fees.
(function (root) {
  'use strict';
  const OA = (root.OA = root.OA || {});

  const calc = {
    // Isolated-margin linear (USDT) perpetual, fees ignored.
    // Long:  margin + q(P - E) = mmr*q*P  ->  P = E(1 - 1/L) / (1 - mmr)
    // Short: margin - q(P - E) = mmr*q*P  ->  P = E(1 + 1/L) / (1 + mmr)
    liqPrice(side, entry, lev, mmr) {
      return side === 'long'
        ? (entry * (1 - 1 / lev)) / (1 - mmr)
        : (entry * (1 + 1 / lev)) / (1 + mmr);
    },
    // Unrealized PnL of a linear perp position.
    perpPnl(side, entry, price, qty) {
      return (side === 'long' ? 1 : -1) * (price - entry) * qty;
    },
    // Funding paid by the position (positive = you pay). rate is per period, e.g. 0.0001.
    fundingPaid(side, notional, rate, periods) {
      return (side === 'long' ? 1 : -1) * notional * rate * periods;
    },
    // Annualized funding from a per-8h rate (3 periods a day).
    fundingAnnual(rate8h) {
      return rate8h * 3 * 365;
    },
    // Impermanent loss of a 50/50 constant-product LP vs holding, r = newPrice / oldPrice.
    impermanentLoss(r) {
      return (2 * Math.sqrt(r)) / (1 + r) - 1;
    },
    // Value of a 50/50 LP deposit V after the price ratio changes by r (fees ignored).
    lpValue(V, r) {
      return V * Math.sqrt(r);
    },
    holdValue(V, r) {
      return (V / 2) * (1 + r);
    },
    // Lending health factor.
    healthFactor(collateralValue, liqThreshold, debt) {
      return (collateralValue * liqThreshold) / debt;
    },
    // Collateral price at which health factor hits 1.
    lendingLiqPrice(collateralAmount, liqThreshold, debt) {
      return debt / (collateralAmount * liqThreshold);
    },
    premium(tokenPrice, refPrice) {
      return tokenPrice / refPrice - 1;
    },
  };

  OA.calc = calc;
})(typeof window !== 'undefined' ? window : globalThis);
