import type { Contribution, Expense, InventoryItem, Partner, Sale } from "@prisma/client";

export type SaleWithItem = Sale & { inventoryItem: InventoryItem };

export function saleNetProfit(sale: SaleWithItem): number {
  const cost = sale.inventoryItem.unitCost * sale.inventoryItem.quantity;
  return sale.salePrice - cost - sale.platformFees - sale.shippingCost;
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

export function cashInPool(
  contributions: Contribution[],
  sales: SaleWithItem[],
  expenses: Expense[],
  inventory: InventoryItem[]
): number {
  const contributed = contributions.reduce((sum, c) => sum + c.amount, 0);
  const purchaseOutflow = inventory.reduce(
    (sum, i) => sum + i.unitCost * i.quantity,
    0
  );
  const saleInflow = sales.reduce(
    (sum, s) => sum + s.salePrice - s.platformFees - s.shippingCost,
    0
  );
  const expenseOutflow = expenses.reduce((sum, e) => sum + e.amount, 0);
  return contributed - purchaseOutflow + saleInflow - expenseOutflow;
}

export type PartnerBalance = {
  partner: Partner;
  contributed: number;
  withdrawn: number;
  profitShare: number;
  expenseShare: number;
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
 * Debits: share of expenses + withdrawals (negative contributions)
 * Balance = credits - debits (withdrawals already reduce contributed)
 *
 * For equal split fairness: each partner should end with the same
 * "equity" relative to their capital. We compute each partner's
 * economic position as:
 *   contributed_net + profit_share - expense_share
 * Then compare to equal ownership of the pool.
 *
 * Simpler readable model from plan:
 * - Credits: capital contributed + 50% of net profit
 * - Debits: 50% of expenses + withdrawals
 * - Balance shows who is ahead; settlement equalizes the two balances.
 */
export function computePartnerSettlement(
  partners: Partner[],
  contributions: Contribution[],
  sales: SaleWithItem[],
  expenses: Expense[]
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
    const balance = contributed - withdrawn + profitShare - expenseShare;

    return {
      partner,
      contributed,
      withdrawn,
      profitShare,
      expenseShare,
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
