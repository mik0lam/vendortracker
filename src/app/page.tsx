import {
  Banknote,
  Package,
  TrendingUp,
  ShoppingBag,
  Users,
  ArrowRight,
  ArrowLeftRight,
  Receipt,
} from "lucide-react";
import Link from "next/link";
import {
  cashInPool,
  computePartnerSettlement,
  inventoryValueAtCost,
  monthToDateProfit,
} from "@/lib/calculations";
import { formatCurrency, formatDate } from "@/lib/format";
import { prisma } from "@/lib/db";
import {
  Badge,
  Card,
  LinkButton,
  PageHeader,
  StatCard,
} from "@/components/ui";

export const dynamic = "force-dynamic";

type ActivityItem = {
  id: string;
  sortAt: number;
  href: string;
  kind: "sale" | "trade" | "buy";
  title: string;
  detail: string;
};

export default async function DashboardPage() {
  const [
    partners,
    inventory,
    sales,
    expenses,
    contributions,
    collectionWithdrawals,
    trades,
    recentSales,
    recentTrades,
    recentBuys,
  ] = await Promise.all([
    prisma.partner.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.inventoryItem.findMany(),
    prisma.sale.findMany({
      include: { inventoryItem: true, receivedBy: true },
    }),
    prisma.expense.findMany(),
    prisma.contribution.findMany(),
    prisma.collectionWithdrawal.findMany(),
    prisma.trade.findMany(),
    prisma.sale.findMany({
      take: 12,
      orderBy: { createdAt: "desc" },
      include: { inventoryItem: true },
    }),
    prisma.trade.findMany({
      take: 12,
      orderBy: { createdAt: "desc" },
      include: {
        outItems: { include: { inventoryItem: true } },
        inItems: { include: { inventoryItem: true } },
      },
    }),
    prisma.buyLineItem.findMany({
      take: 12,
      orderBy: { createdAt: "desc" },
      include: { buySession: true },
    }),
  ]);

  const inStock = inventory.filter((i) => i.status === "in_stock");
  const cash = cashInPool(contributions, sales, expenses, inventory, trades);
  const invValue = inventoryValueAtCost(inventory);
  const mtd = monthToDateProfit(sales, expenses);
  const settlement = computePartnerSettlement(
    partners,
    contributions,
    sales,
    expenses,
    collectionWithdrawals,
    trades
  );

  const activity: ActivityItem[] = [
    ...recentSales.map((sale) => ({
      id: `sale-${sale.id}`,
      sortAt: new Date(sale.createdAt).getTime(),
      href: "/sales",
      kind: "sale" as const,
      title: `Sold ${sale.inventoryItem.name}`,
      detail: `${formatCurrency(sale.salePrice)} · ${formatDate(sale.saleDate)}`,
    })),
    ...recentTrades.map((trade) => {
      const outNames = trade.outItems
        .map((row) => row.inventoryItem.name)
        .slice(0, 2)
        .join(", ");
      const inNames = trade.inItems
        .map((row) => row.inventoryItem.name)
        .slice(0, 2)
        .join(", ");
      const moreOut =
        trade.outItems.length > 2 ? ` +${trade.outItems.length - 2}` : "";
      const moreIn =
        trade.inItems.length > 2 ? ` +${trade.inItems.length - 2}` : "";
      const cashBits: string[] = [];
      if (trade.cashPaid > 0) cashBits.push(`paid ${formatCurrency(trade.cashPaid)}`);
      if (trade.cashReceived > 0) {
        cashBits.push(`recv ${formatCurrency(trade.cashReceived)}`);
      }
      return {
        id: `trade-${trade.id}`,
        sortAt: new Date(trade.createdAt).getTime(),
        href: trade.buySessionId ? `/buy/${trade.buySessionId}` : "/trades",
        kind: "trade" as const,
        title: `Trade · ${outNames}${moreOut} → ${inNames}${moreIn}`,
        detail: [
          formatDate(trade.date),
          cashBits.length > 0 ? cashBits.join(", ") : "no cash",
        ].join(" · "),
      };
    }),
    ...recentBuys.map((buy) => ({
      id: `buy-${buy.id}`,
      sortAt: new Date(buy.createdAt).getTime(),
      href: `/buy/${buy.buySessionId}`,
      kind: "buy" as const,
      title: `Bought ${buy.name}`,
      detail: [
        buy.buySession.name,
        formatCurrency(buy.unitCost * buy.quantity),
        formatDate(buy.createdAt),
      ].join(" · "),
    })),
  ]
    .sort((a, b) => b.sortAt - a.sortAt)
    .slice(0, 12);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Shared pool snapshot for your Pokemon card business."
        actions={
          <>
            <LinkButton href="/buy">Show buys</LinkButton>
            <LinkButton href="/inventory">Add purchase</LinkButton>
            <LinkButton href="/reports" variant="secondary">
              View reports
            </LinkButton>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Cash in pool"
          value={formatCurrency(cash)}
          hint="Shared-pool cash only (personal sale receipts excluded)"
          tone="indigo"
          icon={<Banknote className="h-[18px] w-[18px]" />}
        />
        <StatCard
          label="Inventory at cost"
          value={formatCurrency(invValue)}
          hint={`${inStock.length} cards in stock`}
          tone="emerald"
          icon={<Package className="h-[18px] w-[18px]" />}
        />
        <StatCard
          label="MTD net profit"
          value={formatCurrency(mtd)}
          hint="Gross profit − expenses this month"
          tone={mtd >= 0 ? "amber" : "violet"}
          icon={<TrendingUp className="h-[18px] w-[18px]" />}
        />
        <StatCard
          label="Cards sold"
          value={String(sales.length)}
          hint={`${inventory.length} total tracked`}
          tone="violet"
          icon={<ShoppingBag className="h-[18px] w-[18px]" />}
        />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <Card>
          <div className="mb-4 flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-soft text-primary">
              <Users className="h-[18px] w-[18px]" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Partner balances</h2>
              <p className="text-sm text-muted">{settlement.settlementMessage}</p>
            </div>
          </div>
          <ul className="space-y-3">
            {settlement.partners.map((p) => (
              <li
                key={p.partner.id}
                className="flex items-center justify-between rounded-xl border border-border/60 bg-card-muted px-4 py-3"
              >
                <div>
                  <p className="font-semibold">{p.partner.name}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    Contributed {formatCurrency(p.contributed)} · Profit share{" "}
                    {formatCurrency(p.profitShare)}
                    {p.salesReceived > 0
                      ? ` · Sales received ${formatCurrency(p.salesReceived)}`
                      : ""}
                    {p.tradeCashReceived > 0
                      ? ` · Trade cash ${formatCurrency(p.tradeCashReceived)}`
                      : ""}
                    {p.personalCollectionTaken > 0
                      ? ` · Collection ${formatCurrency(p.personalCollectionTaken)}`
                      : ""}
                  </p>
                </div>
                <p
                  className={`text-lg font-bold tabular-nums ${
                    p.balance >= 0 ? "text-success" : "text-danger"
                  }`}
                >
                  {formatCurrency(p.balance)}
                </p>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-soft text-amber-600">
                <Receipt className="h-[18px] w-[18px]" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Recent activity</h2>
                <p className="text-sm text-muted">
                  Latest sales, trades, and show buys
                </p>
              </div>
            </div>
          </div>

          {activity.length === 0 ? (
            <p className="text-sm text-muted">
              No activity yet. Log a show buy, trade, or sale to see it here.
            </p>
          ) : (
            <ul className="space-y-2">
              {activity.map((item) => (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    className="flex items-start gap-3 rounded-xl border border-border/60 bg-card-muted/50 px-3 py-2.5 transition hover:border-primary/25 hover:bg-primary-soft/30"
                  >
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white text-muted shadow-sm">
                      {item.kind === "sale" ? (
                        <ShoppingBag className="h-3.5 w-3.5" />
                      ) : item.kind === "trade" ? (
                        <ArrowLeftRight className="h-3.5 w-3.5" />
                      ) : (
                        <Package className="h-3.5 w-3.5" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-medium">
                          {item.title}
                        </span>
                        <Badge
                          variant={
                            item.kind === "sale"
                              ? "success"
                              : item.kind === "trade"
                                ? "indigo"
                                : "muted"
                          }
                        >
                          {item.kind === "sale"
                            ? "Sale"
                            : item.kind === "trade"
                              ? "Trade"
                              : "Buy"}
                        </Badge>
                      </span>
                      <span className="mt-0.5 block text-xs text-muted">
                        {item.detail}
                      </span>
                    </span>
                    <ArrowRight className="mt-1 h-3.5 w-3.5 shrink-0 text-muted" />
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-5 flex flex-wrap gap-4 border-t border-border pt-4">
            <Link
              href="/sales"
              className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              Sales <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <Link
              href="/trades"
              className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              Trades <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <Link
              href="/buy"
              className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              Show buys <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
