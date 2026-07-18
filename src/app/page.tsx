import {
  Banknote,
  Package,
  TrendingUp,
  ShoppingBag,
  Users,
  Lightbulb,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import {
  cashInPool,
  computePartnerSettlement,
  inventoryValueAtCost,
  monthToDateProfit,
} from "@/lib/calculations";
import { formatCurrency } from "@/lib/format";
import { prisma } from "@/lib/db";
import {
  Card,
  LinkButton,
  PageHeader,
  StatCard,
} from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [partners, inventory, sales, expenses, contributions] =
    await Promise.all([
      prisma.partner.findMany({ orderBy: { createdAt: "asc" } }),
      prisma.inventoryItem.findMany(),
      prisma.sale.findMany({ include: { inventoryItem: true } }),
      prisma.expense.findMany(),
      prisma.contribution.findMany(),
    ]);

  const inStock = inventory.filter((i) => i.status === "in_stock");
  const cash = cashInPool(contributions, sales, expenses, inventory);
  const invValue = inventoryValueAtCost(inventory);
  const mtd = monthToDateProfit(sales, expenses);
  const settlement = computePartnerSettlement(
    partners,
    contributions,
    sales,
    expenses
  );

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
          hint="Contributions − purchases + net sales − expenses"
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
          <div className="mb-4 flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-soft text-amber-600">
              <Lightbulb className="h-[18px] w-[18px]" />
            </div>
            <h2 className="text-lg font-semibold">Quick tips</h2>
          </div>
          <ol className="space-y-3 text-sm text-muted">
            {[
              "At a show, use Show buys to log who paid and what goes shared vs collection.",
              "Log every purchase under Inventory with cost and grade.",
              "When you sell, record price and fees so profit is accurate.",
              "Log partner cash in/out under Contributions.",
              "Use Reports at month-end for P&L, settlement, and CSV export.",
            ].map((tip, i) => (
              <li key={tip} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                  {i + 1}
                </span>
                <span className="pt-0.5 leading-relaxed">{tip}</span>
              </li>
            ))}
          </ol>
          <div className="mt-5 flex flex-wrap gap-4 border-t border-border pt-4">
            <Link
              href="/sales"
              className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              Sales history <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <Link
              href="/contributions"
              className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              Contributions <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
