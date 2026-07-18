import type { BuyLineItem, Partner } from "@prisma/client";

export type BuyLineWithPartners = BuyLineItem & {
  paidBy: Partner;
  collectionPartner: Partner | null;
};

export function lineTotal(item: Pick<BuyLineItem, "unitCost" | "quantity">): number {
  return item.unitCost * item.quantity;
}

export type SessionSummary = {
  totalSpent: number;
  sharedSpent: number;
  personalSpent: number;
  byPayer: { partner: Partner; amount: number }[];
  sharedCount: number;
  personalCount: number;
  personalDebts: { from: Partner; to: Partner; amount: number }[];
};

export function computeSessionSummary(
  items: BuyLineWithPartners[],
  partners: Partner[]
): SessionSummary {
  let totalSpent = 0;
  let sharedSpent = 0;
  let personalSpent = 0;
  let sharedCount = 0;
  let personalCount = 0;

  const payerMap = new Map<string, number>();
  const debtMap = new Map<string, number>();

  for (const item of items) {
    const total = lineTotal(item);
    totalSpent += total;
    payerMap.set(
      item.paidByPartnerId,
      (payerMap.get(item.paidByPartnerId) ?? 0) + total
    );

    if (item.allocation === "shared") {
      sharedSpent += total;
      sharedCount += item.quantity;
    } else {
      personalSpent += total;
      personalCount += item.quantity;

      if (
        item.collectionPartnerId &&
        item.collectionPartnerId !== item.paidByPartnerId
      ) {
        const key = `${item.collectionPartnerId}->${item.paidByPartnerId}`;
        debtMap.set(key, (debtMap.get(key) ?? 0) + total);
      }
    }
  }

  const byPayer = partners
    .map((partner) => ({
      partner,
      amount: payerMap.get(partner.id) ?? 0,
    }))
    .filter((row) => row.amount > 0);

  const personalDebts: SessionSummary["personalDebts"] = [];
  for (const [key, amount] of debtMap.entries()) {
    const [fromId, toId] = key.split("->");
    const from = partners.find((p) => p.id === fromId);
    const to = partners.find((p) => p.id === toId);
    if (from && to) {
      personalDebts.push({ from, to, amount });
    }
  }

  return {
    totalSpent,
    sharedSpent,
    personalSpent,
    byPayer,
    sharedCount,
    personalCount,
    personalDebts,
  };
}

export function allocationLabel(
  item: BuyLineWithPartners,
  partners: Partner[]
): string {
  if (item.allocation === "shared") return "Shared pool";
  const owner =
    item.collectionPartner?.name ??
    partners.find((p) => p.id === item.collectionPartnerId)?.name ??
    "Personal";
  return `${owner}'s collection`;
}
