import { ArrowLeftRight } from "lucide-react";
import { deleteTrade } from "@/app/actions";
import { TradeForm } from "@/components/TradeForm";
import { DeleteButton } from "@/components/DeleteButton";
import { CardThumb } from "@/components/CardThumb";
import {
  Badge,
  Card,
  EmptyState,
  PageHeader,
  SectionHeader,
  Table,
  TableRow,
  Td,
  Th,
} from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/format";
import { prisma } from "@/lib/db";
import { getOwnerId } from "@/lib/auth";
import { getPartners } from "@/lib/partners";

export const dynamic = "force-dynamic";

export default async function TradesPage() {
  const ownerId = await getOwnerId();
  const [partners, inStock, trades] = await Promise.all([
    getPartners(ownerId),
    prisma.inventoryItem.findMany({
      where: { ownerId, status: "in_stock" },
      orderBy: { purchaseDate: "desc" },
    }),
    prisma.trade.findMany({
      where: { ownerId },
      orderBy: { date: "desc" },
      include: {
        cashPaidBy: true,
        cashReceivedBy: true,
        outItems: { include: { inventoryItem: true } },
        inItems: { include: { inventoryItem: true } },
      },
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="Trades"
        description="Multi-card swaps with optional cash either way. Incoming cards go to shared inventory."
      />

      <Card hover>
        <SectionHeader
          title="Record trade"
          description="Outgoing cards leave as traded; incoming get cost basis from outgoing costs ± cash"
        />
        <TradeForm
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

      <div className="mt-8">
        <SectionHeader
          title="Trade history"
          description={`${trades.length} trade${trades.length === 1 ? "" : "s"}`}
        />

        {trades.length === 0 ? (
          <EmptyState
            message="No trades recorded yet."
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
                <Th>Notes</Th>
                <Th>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {trades.map((trade) => {
                const cashBits: string[] = [];
                if (trade.cashPaid > 0) {
                  cashBits.push(
                    `Paid ${formatCurrency(trade.cashPaid)} (${trade.cashPaidBy?.name ?? "Shared"})`
                  );
                }
                if (trade.cashReceived > 0) {
                  cashBits.push(
                    `Recv ${formatCurrency(trade.cashReceived)} (${trade.cashReceivedBy?.name ?? "Shared"})`
                  );
                }
                return (
                  <TableRow key={trade.id}>
                    <Td className="whitespace-nowrap text-muted">
                      {formatDate(trade.date)}
                    </Td>
                    <Td>
                      <ul className="space-y-1.5">
                        {trade.outItems.map((row) => (
                          <li
                            key={row.id}
                            className="flex items-center gap-2 text-sm"
                          >
                            <CardThumb
                              src={row.inventoryItem.imageUrl}
                              alt={row.inventoryItem.name}
                            />
                            <span className="min-w-0">
                              <span className="font-medium">
                                {row.inventoryItem.name}
                              </span>
                              <span className="block text-xs text-muted">
                                cost{" "}
                                {formatCurrency(
                                  row.inventoryItem.unitCost *
                                    row.inventoryItem.quantity
                                )}
                              </span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    </Td>
                    <Td>
                      <ul className="space-y-1.5">
                        {trade.inItems.map((row) => (
                          <li
                            key={row.id}
                            className="flex items-center gap-2 text-sm"
                          >
                            <CardThumb
                              src={row.inventoryItem.imageUrl}
                              alt={row.inventoryItem.name}
                            />
                            <span className="min-w-0">
                              <span className="font-medium">
                                {row.inventoryItem.name}
                              </span>
                              <span className="block text-xs text-muted">
                                basis {formatCurrency(row.allocatedCost)}
                                {row.marketPriceUsed > 0
                                  ? ` · mkt ${formatCurrency(row.marketPriceUsed)}`
                                  : ""}
                              </span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    </Td>
                    <Td className="text-sm text-muted">
                      {cashBits.length > 0 ? (
                        <ul className="space-y-1">
                          {cashBits.map((bit) => (
                            <li key={bit}>{bit}</li>
                          ))}
                        </ul>
                      ) : (
                        <Badge variant="muted">No cash</Badge>
                      )}
                    </Td>
                    <Td className="max-w-[12rem] text-sm text-muted">
                      {trade.notes ?? "—"}
                    </Td>
                    <Td>
                      <DeleteButton
                        confirmMessage="Reverse this trade? Incoming cards will be deleted and outgoing restored to stock."
                        action={deleteTrade.bind(null, trade.id)}
                      />
                    </Td>
                  </TableRow>
                );
              })}
            </tbody>
          </Table>
        )}
      </div>
    </div>
  );
}
