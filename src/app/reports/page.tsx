import Link from "next/link";
import { ArrowRight, BarChart3, Download } from "lucide-react";
import {
  computeMonthlyPnL,
  computePartnerSettlement,
  inventoryValueAtCost,
  receiverLabel,
} from "@/lib/calculations";
import { formatCurrency, formatDate } from "@/lib/format";
import { itemDisplayLabel } from "@/lib/item-label";
import { prisma } from "@/lib/db";
import {
  Button,
  Card,
  EmptyState,
  ExportLink,
  Field,
  Input,
  PageHeader,
  SectionHeader,
  Table,
  TableRow,
  Td,
  Th,
} from "@/components/ui";

export const dynamic = "force-dynamic";

function parseMonth(value?: string): { year: number; month: number } {
  const fallback = new Date();
  if (!value || !/^\d{4}-\d{2}$/.test(value)) {
    return { year: fallback.getFullYear(), month: fallback.getMonth() + 1 };
  }
  const [y, m] = value.split("-").map(Number);
  return { year: y, month: m };
}

function PnlRow({
  label,
  value,
  bold = false,
  highlight = false,
  positive,
}: {
  label: string;
  value: string;
  bold?: boolean;
  highlight?: boolean;
  positive?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between py-2 ${
        highlight ? "border-t border-border pt-3" : ""
      }`}
    >
      <dt className={bold ? "font-semibold text-foreground" : "text-muted"}>
        {label}
      </dt>
      <dd
        className={`tabular-nums ${
          bold ? "text-lg font-bold" : "font-medium"
        } ${
          positive === true
            ? "text-success"
            : positive === false
              ? "text-danger"
              : ""
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const params = await searchParams;
  const { year, month } = parseMonth(params.month);
  const monthValue = `${year}-${String(month).padStart(2, "0")}`;

  const [
    partners,
    inventory,
    sales,
    expenses,
    contributions,
    collectionWithdrawals,
    trades,
  ] = await Promise.all([
    prisma.partner.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.inventoryItem.findMany({ orderBy: { purchaseDate: "desc" } }),
    prisma.sale.findMany({
      include: { inventoryItem: true, receivedBy: true },
      orderBy: { saleDate: "desc" },
    }),
    prisma.expense.findMany({ orderBy: { date: "desc" } }),
    prisma.contribution.findMany(),
    prisma.collectionWithdrawal.findMany({
      include: { inventoryItem: true, takenBy: true },
      orderBy: { date: "desc" },
    }),
    prisma.trade.findMany(),
  ]);

  const pnl = computeMonthlyPnL(year, month, sales, expenses, partners);
  const settlement = computePartnerSettlement(
    partners,
    contributions,
    sales,
    expenses,
    collectionWithdrawals,
    trades
  );
  const inStock = inventory.filter((i) => i.status === "in_stock");
  const invValue = inventoryValueAtCost(inventory);
  const monthLabel = new Date(year, month - 1, 1).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });
  const monthCollectionWithdrawals = collectionWithdrawals.filter(
    (withdrawal) => {
      const date = new Date(withdrawal.date);
      return date.getFullYear() === year && date.getMonth() + 1 === month;
    }
  );

  return (
    <div>
      <PageHeader
        title="Reports"
        description="Monthly P&L, partner settlement, and CSV exports for taxes."
        actions={
          <form className="flex items-end gap-2">
            <Field label="Month" htmlFor="month">
              <Input
                id="month"
                name="month"
                type="month"
                defaultValue={monthValue}
                className="w-auto min-w-[10rem]"
              />
            </Field>
            <Button type="submit">Update</Button>
          </form>
        }
      />

      <Card className="mb-6 !p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium text-muted">
          <Download className="h-4 w-4" />
          Export data
        </div>
        <div className="flex flex-wrap gap-2">
          <ExportLink href={`/api/export?type=summary&month=${monthValue}`}>
            Monthly summary
          </ExportLink>
          <ExportLink href={`/api/export?type=sales&month=${monthValue}`}>
            Sales
          </ExportLink>
          <ExportLink href={`/api/export?type=expenses&month=${monthValue}`}>
            Expenses
          </ExportLink>
          <ExportLink href={`/api/export?type=inventory`}>Inventory</ExportLink>
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <div className="mb-4 flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
              <BarChart3 className="h-[18px] w-[18px]" />
            </div>
            <h2 className="text-lg font-semibold">P&L · {monthLabel}</h2>
          </div>
          <dl className="text-sm">
            <PnlRow label="Revenue" value={formatCurrency(pnl.revenue)} />
            <PnlRow label="COGS" value={formatCurrency(pnl.cogs)} />
            <PnlRow
              label="Gross profit"
              value={formatCurrency(pnl.grossProfit)}
              highlight
              bold
            />
            <PnlRow label="Expenses" value={formatCurrency(pnl.totalExpenses)} />
            <PnlRow
              label="Net profit"
              value={formatCurrency(pnl.netProfit)}
              highlight
              bold
              positive={pnl.netProfit >= 0}
            />
          </dl>

          {pnl.expensesByCategory.length > 0 ? (
            <div className="mt-5 rounded-xl bg-card-muted p-4">
              <h3 className="text-sm font-semibold">Expenses by category</h3>
              <ul className="mt-2 space-y-1.5 text-sm">
                {pnl.expensesByCategory.map((row) => (
                  <li key={row.category} className="flex justify-between">
                    <span className="text-muted">{row.category}</span>
                    <span className="font-medium tabular-nums">
                      {formatCurrency(row.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="mt-5 rounded-xl bg-card-muted p-4">
            <h3 className="text-sm font-semibold">Partner allocation</h3>
            <ul className="mt-2 space-y-1.5 text-sm">
              {pnl.partnerAllocation.map((row) => (
                <li key={row.partner.id} className="flex justify-between">
                  <span className="text-muted">
                    {row.partner.name} ({row.partner.splitPercent}%)
                  </span>
                  <span className="font-medium tabular-nums">
                    {formatCurrency(row.amount)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Card>

        <Card>
          <SectionHeader title="Partner settlement" description={settlement.settlementMessage} />
          <p className="mb-4 text-xs text-muted">
            All-time: profit {formatCurrency(settlement.totalNetProfit)} ·
            expenses {formatCurrency(settlement.totalExpenses)}
          </p>
          <ul className="space-y-3">
            {settlement.partners.map((p) => (
              <li
                key={p.partner.id}
                className="rounded-xl border border-border/60 bg-card-muted px-4 py-3 text-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{p.partner.name}</span>
                  <span
                    className={`text-lg font-bold tabular-nums ${
                      p.balance >= 0 ? "text-success" : "text-danger"
                    }`}
                  >
                    {formatCurrency(p.balance)}
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted">
                  <span>Contributed: {formatCurrency(p.contributed)}</span>
                  <span>Withdrawn: {formatCurrency(p.withdrawn)}</span>
                  <span>Profit share: {formatCurrency(p.profitShare)}</span>
                  <span>Expense share: {formatCurrency(p.expenseShare)}</span>
                  <span>Sales received: {formatCurrency(p.salesReceived)}</span>
                  <span>
                    Trade cash received: {formatCurrency(p.tradeCashReceived)}
                  </span>
                  <span>
                    Personal collection:{" "}
                    {formatCurrency(p.personalCollectionTaken)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card className="mt-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Inventory snapshot</h2>
            <p className="text-sm text-muted">
              {inStock.length} in stock · {formatCurrency(invValue)} at cost
            </p>
          </div>
          <Link
            href="/inventory"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            Manage <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        {inStock.length === 0 ? (
          <div className="mt-4">
            <EmptyState message="No cards currently in stock." />
          </div>
        ) : (
          <div className="mt-4">
            <Table>
              <thead>
                <tr>
                  <Th>Card</Th>
                  <Th>Purchased</Th>
                  <Th>Cost</Th>
                </tr>
              </thead>
              <tbody>
                {inStock.slice(0, 15).map((item) => (
                  <TableRow key={item.id}>
                    <Td className="font-medium">{itemDisplayLabel(item)}</Td>
                    <Td className="text-muted">{formatDate(item.purchaseDate)}</Td>
                    <Td className="tabular-nums">
                      {formatCurrency(item.unitCost * item.quantity)}
                    </Td>
                  </TableRow>
                ))}
              </tbody>
            </Table>
            {inStock.length > 15 ? (
              <p className="mt-2 text-xs text-muted">
                Showing 15 of {inStock.length}. Export inventory CSV for the full list.
              </p>
            ) : null}
          </div>
        )}
      </Card>

      <Card className="mt-5">
        <SectionHeader title={`Sales in ${monthLabel}`} />
        {pnl.sales.length === 0 ? (
          <EmptyState message={`No sales in ${monthLabel}.`} />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Date</Th>
                <Th>Card</Th>
                <Th>Received by</Th>
                <Th>Sale price</Th>
                <Th>Cost</Th>
              </tr>
            </thead>
            <tbody>
              {pnl.sales.map((sale) => (
                <TableRow key={sale.id}>
                  <Td className="text-muted">{formatDate(sale.saleDate)}</Td>
                  <Td className="font-medium">
                    {itemDisplayLabel(sale.inventoryItem)}
                  </Td>
                  <Td className="text-sm text-muted">{receiverLabel(sale)}</Td>
                  <Td className="font-medium tabular-nums">
                    {formatCurrency(sale.salePrice)}
                  </Td>
                  <Td className="tabular-nums">
                    {formatCurrency(
                      sale.inventoryItem.unitCost * sale.inventoryItem.quantity
                    )}
                  </Td>
                </TableRow>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Card className="mt-5">
        <SectionHeader title={`Personal collection in ${monthLabel}`} />
        {monthCollectionWithdrawals.length === 0 ? (
          <EmptyState message={`No collection withdrawals in ${monthLabel}.`} />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Date</Th>
                <Th>Card</Th>
                <Th>Taken by</Th>
                <Th>Cost basis</Th>
              </tr>
            </thead>
            <tbody>
              {monthCollectionWithdrawals.map((withdrawal) => (
                <TableRow key={withdrawal.id}>
                  <Td className="text-muted">
                    {formatDate(withdrawal.date)}
                  </Td>
                  <Td className="font-medium">
                    {itemDisplayLabel(withdrawal.inventoryItem)}
                  </Td>
                  <Td>{withdrawal.takenBy.name}</Td>
                  <Td className="tabular-nums">
                    {formatCurrency(withdrawal.costBasis)}
                  </Td>
                </TableRow>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
