export type TradeIncomingCard = {
  name: string;
  setName?: string | null;
  cardNumber?: string | null;
  cardType?: string;
  condition?: string | null;
  gradeCompany?: string | null;
  grade?: string | null;
  certNumber?: string | null;
  tcgplayerUrl?: string | null;
  tcgplayerProductId?: number | null;
  tcgplayerGroupId?: number | null;
  imageUrl?: string | null;
  marketPrice?: number | null;
  notes?: string | null;
};

export function computeTradeBasis(
  outgoingCosts: number[],
  cashPaid: number,
  cashReceived: number
): number {
  const out = outgoingCosts.reduce((sum, c) => sum + c, 0);
  return Math.max(0, Math.round((out + cashPaid - cashReceived) * 100) / 100);
}

/** Split total basis across incoming cards by market price; even split if all markets are 0. */
export function allocateTradeCosts(
  totalBasis: number,
  marketPrices: number[]
): number[] {
  if (marketPrices.length === 0) return [];
  const sanitized = marketPrices.map((p) =>
    p != null && !Number.isNaN(p) && p > 0 ? p : 0
  );
  const marketSum = sanitized.reduce((sum, p) => sum + p, 0);

  if (marketSum <= 0) {
    const each = Math.round((totalBasis / marketPrices.length) * 100) / 100;
    const costs = sanitized.map(() => each);
    const drift =
      Math.round((totalBasis - costs.reduce((s, c) => s + c, 0)) * 100) / 100;
    costs[costs.length - 1] =
      Math.round((costs[costs.length - 1] + drift) * 100) / 100;
    return costs;
  }

  const costs = sanitized.map(
    (p) => Math.round(((totalBasis * p) / marketSum) * 100) / 100
  );
  const drift =
    Math.round((totalBasis - costs.reduce((s, c) => s + c, 0)) * 100) / 100;
  costs[costs.length - 1] =
    Math.round((costs[costs.length - 1] + drift) * 100) / 100;
  return costs;
}
