import type {
  CollectionWithdrawal,
  Contribution,
  Expense,
  InventoryItem,
  Partner,
  Sale,
  Trade,
} from "@prisma/client";

export type SaleWithItem = Sale & {
  inventoryItem: InventoryItem;
  receivedBy?: Partner | null;
};

export function saleNetProceeds(sale: Pick<Sale, "salePrice" | "platformFees" | "shippingCost">): number {
  return sale.salePrice - sale.platformFees - sale.shippingCost;
}

export function saleNetProfit(sale: SaleWithItem): number {
  const cost = sale.inventoryItem.unitCost * sale.inventoryItem.quantity;
  return saleNetProceeds(sale) - cost;
}

export function saleGrossProfit(sale: SaleWithItem): number {
  const cost = sale.inventoryItem.unitCost * sale.inventoryItem.quantity;
  return sale.salePrice - cost;
}

export function inventoryValueAtCost(items: InventoryItem[]): number {
  return items
    .filter((i) => i.status === "in_stock")
    .reduce((sum, i) => sum + i.unitCost * i.quantity, 0);
}

/**
 * Cash sitting in the shared business pool.
 * Sale proceeds count only when receivedByPartnerId is null (shared pool).
 * Traded-away cards are excluded from purchase outflow (basis moves to incoming).
 * Partner-received trade cash is subtracted so lower incoming costs do not inflate pool cash.
 */
export function cashInPool(
  contributions: Contribution[],
  sales: SaleWithItem[],
  expenses: Expense[],
  inventory: InventoryItem[],
  trades: Pick<Trade, "cashReceived" | "cashReceivedByPartnerId">[] = []
): number {
  const contributed = contributions.reduce((sum, c) => sum + c.amount, 0);
  const purchaseOutflow = inventory
    .filter((i) => i.status !== "traded")
    .reduce((sum, i) => sum + i.unitCost * i.quantity, 0);
  const saleInflow = sales
    .filter((s) => !s.receivedByPartnerId)
    .reduce((sum, s) => sum + saleNetProceeds(s), 0);
  const expenseOutflow = expenses.reduce((sum, e) => sum + e.amount, 0);
  const partnerTradeCashReceived = trades
    .filter((t) => t.cashReceivedByPartnerId && t.cashReceived > 0)
    .reduce((sum, t) => sum + t.cashReceived, 0);
  return (
    contributed - purchaseOutflow + saleInflow - expenseOutflow - partnerTradeCashReceived
  );
}

export type PartnerBalance = {
  partner: Partner;
  contributed: number;
  withdrawn: number;
  profitShare: number;
  expenseShare: number;
  salesReceived: number;
  tradeCashReceived: number;
  personalCollectionTaken: number;
  balance: number;
};

export type SettlementResult = {
  partners: PartnerBalance[];
  settlementMessage: string;
  totalNetProfit: number;
  totalExpenses: number;
};

/**
 * Partner settlement:
 * Credits: capital contributed + share of net profit from sales
 * Debits: share of expenses + withdrawals + personally received sale proceeds
 * (personally held cash is outside the pool, so it reduces that partner's
 * settlement claim relative to equity).
 */
export function computePartnerSettlement(
  partners: Partner[],
  contributions: Contribution[],
  sales: SaleWithItem[],
  expenses: Expense[],
  collectionWithdrawals: CollectionWithdrawal[] = [],
  trades: Pick<Trade, "cashReceived" | "cashReceivedByPartnerId">[] = []
): SettlementResult {
  const totalNetProfit = sales.reduce((sum, s) => sum + saleNetProfit(s), 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const splitTotal = partners.reduce((sum, p) => sum + p.splitPercent, 0) || 100;

  const balances: PartnerBalance[] = partners.map((partner) => {
    const partnerContribs = contributions.filter((c) => c.partnerId === partner.id);
    const contributed = partnerContribs
      .filter((c) => c.amount > 0)
      .reduce((sum, c) => sum + c.amount, 0);
    const withdrawn = partnerContribs
      .filter((c) => c.amount < 0)
      .reduce((sum, c) => sum + Math.abs(c.amount), 0);
    const share = partner.splitPercent / splitTotal;
    const profitShare = totalNetProfit * share;
    const expenseShare = totalExpenses * share;
    const salesReceived = sales
      .filter((s) => s.receivedByPartnerId === partner.id)
      .reduce((sum, s) => sum + saleNetProceeds(s), 0);
    const tradeCashReceived = trades
      .filter((t) => t.cashReceivedByPartnerId === partner.id)
      .reduce((sum, t) => sum + t.cashReceived, 0);
    const personalCollectionTaken = collectionWithdrawals
      .filter((withdrawal) => withdrawal.takenByPartnerId === partner.id)
      .reduce((sum, withdrawal) => sum + withdrawal.costBasis, 0);
    const balance =
      contributed -
      withdrawn +
      profitShare -
      expenseShare -
      salesReceived -
      tradeCashReceived -
      personalCollectionTaken;

    return {
      partner,
      contributed,
      withdrawn,
      profitShare,
      expenseShare,
      salesReceived,
      tradeCashReceived,
      personalCollectionTaken,
      balance,
    };
  });

  let settlementMessage = "Partners are settled up.";
  if (balances.length >= 2) {
    const sorted = [...balances].sort((a, b) => b.balance - a.balance);
    const ahead = sorted[0];
    const behind = sorted[sorted.length - 1];
    const diff = (ahead.balance - behind.balance) / 2;
    if (Math.abs(diff) >= 0.005) {
      settlementMessage = `${behind.partner.name} owes ${ahead.partner.name} ${diff.toLocaleString(
        "en-US",
        { style: "currency", currency: "USD" }
      )} to settle up.`;
    }
  }

  return {
    partners: balances,
    settlementMessage,
    totalNetProfit,
    totalExpenses,
  };
}

export type MonthlyPnL = {
  year: number;
  month: number;
  revenue: number;
  cogs: number;
  grossProfit: number;
  expensesByCategory: { category: string; amount: number }[];
  totalExpenses: number;
  netProfit: number;
  partnerAllocation: { partner: Partner; amount: number }[];
  sales: SaleWithItem[];
  expenses: Expense[];
};

export function computeMonthlyPnL(
  year: number,
  month: number,
  sales: SaleWithItem[],
  expenses: Expense[],
  partners: Partner[]
): MonthlyPnL {
  const monthSales = sales.filter((s) => {
    const d = new Date(s.saleDate);
    return d.getFullYear() === year && d.getMonth() + 1 === month;
  });
  const monthExpenses = expenses.filter((e) => {
    const d = new Date(e.date);
    return d.getFullYear() === year && d.getMonth() + 1 === month;
  });

  const revenue = monthSales.reduce((sum, s) => sum + s.salePrice, 0);
  const cogs = monthSales.reduce(
    (sum, s) => sum + s.inventoryItem.unitCost * s.inventoryItem.quantity,
    0
  );
  const grossProfit = revenue - cogs;

  const categoryMap = new Map<string, number>();
  for (const e of monthExpenses) {
    categoryMap.set(e.category, (categoryMap.get(e.category) ?? 0) + e.amount);
  }
  const expensesByCategory = [...categoryMap.entries()]
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);

  const totalExpenses = monthExpenses.reduce((sum, e) => sum + e.amount, 0);
  const netProfit = grossProfit - totalExpenses;

  const splitTotal = partners.reduce((sum, p) => sum + p.splitPercent, 0) || 100;
  const partnerAllocation = partners.map((partner) => ({
    partner,
    amount: netProfit * (partner.splitPercent / splitTotal),
  }));

  return {
    year,
    month,
    revenue,
    cogs,
    grossProfit,
    expensesByCategory,
    totalExpenses,
    netProfit,
    partnerAllocation,
    sales: monthSales,
    expenses: monthExpenses,
  };
}

export function monthToDateProfit(
  sales: SaleWithItem[],
  expenses: Expense[],
  now = new Date()
): number {
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const pnl = computeMonthlyPnL(year, month, sales, expenses, []);
  return pnl.grossProfit - pnl.totalExpenses;
}

export function receiverLabel(sale: SaleWithItem): string {
  if (!sale.receivedByPartnerId) return "Shared pool";
  return sale.receivedBy?.name ?? "Partner";
}
