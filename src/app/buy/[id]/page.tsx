import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowLeftRight, Users } from "lucide-react";
import {
  deleteBuyLineItem,
  deleteBuySession,
  deleteTrade,
} from "@/app/actions";
import { BuyLineForm } from "@/components/BuyLineForm";
import { TradeForm } from "@/components/TradeForm";
import { DeleteButton } from "@/components/DeleteButton";
import { CardThumb } from "@/components/CardThumb";
import {
  Badge,
  Card,
  EmptyState,
  PageHeader,
  SectionHeader,
  StatCard,
  Table,
  TableRow,
  Td,
  Th,
} from "@/components/ui";
import {
  allocationLabel,
  computeSessionSummary,
  lineTotal,
} from "@/lib/buy-summary";
import { formatCurrency, formatDate } from "@/lib/format";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function BuySessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [session, partners, inStock] = await Promise.all([
    prisma.buySession.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            paidBy: true,
            collectionPartner: true,
            inventoryItem: true,
          },
          orderBy: { createdAt: "desc" },
        },
        trades: {
          include: {
            cashPaidBy: true,
            cashReceivedBy: true,
            outItems: { include: { inventoryItem: true } },
            inItems: { include: { inventoryItem: true } },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    }),
    prisma.partner.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.inventoryItem.findMany({
      where: { status: "in_stock" },
      orderBy: { purchaseDate: "desc" },
    }),
  ]);

  if (!session) notFound();

  const summary = computeSessionSummary(session.items, partners);

  return (
    <div>
      <Link
        href="/buy"
        className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" />
        All show days
      </Link>

      <PageHeader
        title={session.name}
        description={[
          formatDate(session.date),
          session.location,
        ]
          .filter(Boolean)
          .join(" · ")}
        actions={
          <DeleteButton
            label="Delete show day"
            confirmMessage={`Delete "${session.name}" and all ${session.items.length} cards? Shared inventory entries will be removed too.`}
            action={deleteBuySession.bind(null, session.id)}
          />
        }
      />

      {session.notes ? (
        <p className="mb-6 rounded-xl bg-card-muted px-4 py-3 text-sm text-muted">
          {session.notes}
        </p>
      ) : null}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total spent"
          value={formatCurrency(summary.totalSpent)}
          tone="indigo"
        />
        <StatCard
          label="Shared pool"
          value={formatCurrency(summary.sharedSpent)}
          hint={`${summary.sharedCount} card${summary.sharedCount === 1 ? "" : "s"} → inventory`}
          tone="emerald"
        />
        <StatCard
          label="Personal collection"
          value={formatCurrency(summary.personalSpent)}
          hint={`${summary.personalCount} card${summary.personalCount === 1 ? "" : "s"}`}
          tone="amber"
        />
        <StatCard
          label="Cards logged"
          value={String(session.items.length)}
          tone="violet"
        />
      </div>

      <div className="mb-6 grid gap-5 lg:grid-cols-2">
        <Card>
          <SectionHeader
            title="Who paid"
            description="Cash out of pocket at the show"
          />
          {summary.byPayer.length === 0 ? (
            <p className="text-sm text-muted">No purchases yet.</p>
          ) : (
            <ul className="space-y-2">
              {summary.byPayer.map((row) => (
                <li
                  key={row.partner.id}
                  className="flex items-center justify-between rounded-xl bg-card-muted px-3 py-2"
                >
                  <span className="font-medium">{row.partner.name}</span>
                  <span className="font-semibold tabular-nums">
                    {formatCurrency(row.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <SectionHeader
            title="Collection settle-up"
            description="When someone pays for the other person's personal card"
          />
          {summary.personalDebts.length === 0 ? (
            <p className="text-sm text-muted">
              No cross-partner collection buys yet. Personal cards paid by the
              owner don't need settling.
            </p>
          ) : (
            <ul className="space-y-2">
              {summary.personalDebts.map((debt) => (
                <li
                  key={`${debt.from.id}-${debt.to.id}`}
                  className="flex items-start gap-2 rounded-xl border border-amber-200/80 bg-accent-soft/50 px-3 py-3 text-sm"
                >
                  <Users className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <span>
                    <strong>{debt.from.name}</strong> owes{" "}
                    <strong>{debt.to.name}</strong>{" "}
                    <span className="font-semibold text-amber-800">
                      {formatCurrency(debt.amount)}
                    </span>{" "}
                    for collection cards they paid for.
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card hover className="mb-8">
        <SectionHeader
          title="Add card"
          description="Log each purchase as you buy — shared cards go straight to inventory"
        />
        <BuyLineForm
          buySessionId={session.id}
          partners={partners.map((p) => ({ id: p.id, name: p.name }))}
        />
      </Card>

      <Card hover className="mb-8">
        <SectionHeader
          title="Record a trade"
          description="Trade any in-stock cards; received cards stay attached to this show and enter shared inventory"
        />
        <TradeForm
          buySessionId={session.id}
          defaultDate={session.date}
          inStock={inStock.map((item) => ({
            id: item.id,
            name: item.name,
            setName: item.setName,
            cardNumber: item.cardNumber,
            unitCost: item.unitCost,
            quantity: item.quantity,
            imageUrl: item.imageUrl,
            condition: item.condition,
            gradeCompany: item.gradeCompany,
            grade: item.grade,
            cardType: item.cardType,
          }))}
          partners={partners.map((partner) => ({
            id: partner.id,
            name: partner.name,
          }))}
        />
      </Card>

      <SectionHeader
        title="Trades this show"
        description={`${session.trades.length} trade${session.trades.length === 1 ? "" : "s"}`}
      />

      {session.trades.length === 0 ? (
        <EmptyState
          message="No trades recorded for this show yet."
          icon={<ArrowLeftRight className="h-5 w-5" />}
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Date</Th>
              <Th>Gave</Th>
              <Th>Received</Th>
              <Th>Cash</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {session.trades.map((trade) => (
              <TableRow key={trade.id}>
                <Td className="whitespace-nowrap text-muted">
                  {formatDate(trade.date)}
                </Td>
                <Td>
                  <ul className="space-y-1.5">
                    {trade.outItems.map((row) => (
                      <li key={row.id} className="flex items-center gap-2">
                        <CardThumb
                          src={row.inventoryItem.imageUrl}
                          alt={row.inventoryItem.name}
                        />
                        <span className="text-sm font-medium">
                          {row.inventoryItem.name}
                        </span>
                      </li>
                    ))}
                  </ul>
                </Td>
                <Td>
                  <ul className="space-y-1.5">
                    {trade.inItems.map((row) => (
                      <li key={row.id} className="flex items-center gap-2">
                        <CardThumb
                          src={row.inventoryItem.imageUrl}
                          alt={row.inventoryItem.name}
                        />
                        <span>
                          <span className="block text-sm font-medium">
                            {row.inventoryItem.name}
                          </span>
                          <span className="block text-xs text-muted">
                            basis {formatCurrency(row.allocatedCost)}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </Td>
                <Td className="text-sm text-muted">
                  {trade.cashPaid > 0 ? (
                    <div>
                      Paid {formatCurrency(trade.cashPaid)} (
                      {trade.cashPaidBy?.name ?? "Shared"})
                    </div>
                  ) : null}
                  {trade.cashReceived > 0 ? (
                    <div>
                      Received {formatCurrency(trade.cashReceived)} (
                      {trade.cashReceivedBy?.name ?? "Shared"})
                    </div>
                  ) : null}
                  {trade.cashPaid === 0 && trade.cashReceived === 0
                    ? "No cash"
                    : null}
                </Td>
                <Td>
                  <DeleteButton
                    label="Reverse"
                    confirmMessage="Reverse this trade? Incoming cards will be removed and outgoing cards restored."
                    action={deleteTrade.bind(null, trade.id)}
                  />
                </Td>
              </TableRow>
            ))}
          </tbody>
        </Table>
      )}

      <div className="mb-8" />

      <SectionHeader
        title="Purchases"
        description={`${session.items.length} card${session.items.length === 1 ? "" : "s"} this show`}
      />

      {session.items.length === 0 ? (
        <EmptyState message="No cards logged yet. Add your first purchase above." />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Card</Th>
              <Th>Cost</Th>
              <Th>Paid by</Th>
              <Th>Destination</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {session.items.map((item) => (
              <TableRow key={item.id}>
                <Td>
                  <div className="font-semibold">{item.name}</div>
                  {item.setName ? (
                    <div className="text-xs text-muted">{item.setName}</div>
                  ) : null}
                </Td>
                <Td className="font-medium tabular-nums">
                  {formatCurrency(lineTotal(item))}
                </Td>
                <Td>{item.paidBy.name}</Td>
                <Td>
                  <Badge
                    variant={item.allocation === "shared" ? "success" : "warning"}
                  >
                    {allocationLabel(item, partners)}
                  </Badge>
                  {item.inventoryItemId ? (
                    <div className="mt-1">
                      <Link
                        href="/inventory"
                        className="text-xs text-primary hover:underline"
                      >
                        In inventory →
                      </Link>
                    </div>
                  ) : null}
                </Td>
                <Td>
                  <DeleteButton
                    confirmMessage={`Remove "${item.name}" from this show?${item.allocation === "shared" ? " This will also remove it from shared inventory." : ""}`}
                    action={deleteBuyLineItem.bind(null, item.id)}
                  />
                </Td>
              </TableRow>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
