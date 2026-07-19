import { Receipt } from "lucide-react";
import { deleteCollectionWithdrawal, deleteSale } from "@/app/actions";
import { DeleteButton } from "@/components/DeleteButton";
import { SaleForm } from "@/components/SaleForm";
import { CollectionWithdrawalForm } from "@/components/CollectionWithdrawalForm";
import { CardThumb } from "@/components/CardThumb";
import {
  Card,
  EmptyState,
  PageHeader,
  SectionHeader,
  Table,
  TableRow,
  Td,
  Th,
} from "@/components/ui";
import {
  receiverLabel,
  saleNetProfit,
} from "@/lib/calculations";
import { formatCurrency, formatDate } from "@/lib/format";
import { itemDisplayLabel } from "@/lib/item-label";
import { prisma } from "@/lib/db";
import { getOwnerId } from "@/lib/auth";
import { getPartners } from "@/lib/partners";
import { fetchMarketPricesForGroups } from "@/lib/tcgcsv";

export const dynamic = "force-dynamic";

export default async function SalesPage() {
  const ownerId = await getOwnerId();
  const [sales, inStock, partners, collectionWithdrawals] = await Promise.all([
    prisma.sale.findMany({
      where: { ownerId },
      include: { inventoryItem: true, receivedBy: true },
      orderBy: { saleDate: "desc" },
    }),
    prisma.inventoryItem.findMany({
      where: { ownerId, status: "in_stock" },
      orderBy: { purchaseDate: "desc" },
    }),
    getPartners(ownerId),
    prisma.collectionWithdrawal.findMany({
      where: { ownerId },
      include: { inventoryItem: true, takenBy: true },
      orderBy: { date: "desc" },
    }),
  ]);

  const options = inStock.map((i) => ({
    id: i.id,
    name: i.name,
    unitCost: i.unitCost,
    quantity: i.quantity,
    imageUrl: i.imageUrl,
    setName: i.setName,
    cardNumber: i.cardNumber,
    condition: i.condition,
    gradeCompany: i.gradeCompany,
    grade: i.grade,
    label: `${itemDisplayLabel(i)} · cost ${formatCurrency(i.unitCost * i.quantity)}`,
  }));

  const partnerOptions = partners.map((p) => ({ id: p.id, name: p.name }));

  const groupIds = sales
    .filter((s) => s.inventoryItem.tcgplayerGroupId != null)
    .map((s) => ({
      groupId: s.inventoryItem.tcgplayerGroupId as number,
      language: s.inventoryItem.language,
    }));
  const livePrices = await fetchMarketPricesForGroups(groupIds);

  return (
    <div>
      <PageHeader
        title="Sales"
        description="Sale history with net profit after cost, fees, and shipping."
      />

      <div className="mb-8 grid gap-5 lg:grid-cols-2">
        <Card hover>
          <SectionHeader
            title="Record sale"
            description="Sell an in-stock card"
          />
          <SaleForm items={options} partners={partnerOptions} />
        </Card>
        <Card hover>
          <SectionHeader
            title="Move to personal collection"
            description="Remove a shared card at purchase cost"
          />
          <CollectionWithdrawalForm
            items={options}
            partners={partnerOptions}
          />
        </Card>
      </div>

      <SectionHeader
        title="Sale history"
        description={`${sales.length} sale${sales.length === 1 ? "" : "s"} recorded`}
      />

      {sales.length === 0 ? (
        <EmptyState
          message="No sales recorded yet."
          icon={<Receipt className="h-5 w-5" />}
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Card</Th>
              <Th>Sale date</Th>
              <Th>Received by</Th>
              <Th>Sale price</Th>
              <Th>Fees + ship</Th>
              <Th>Cost</Th>
              <Th>TCG market</Th>
              <Th>Net profit</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {sales.map((sale) => {
              const cost =
                sale.inventoryItem.unitCost * sale.inventoryItem.quantity;
              const profit = saleNetProfit(sale);
              const live =
                sale.inventoryItem.tcgplayerProductId != null
                  ? livePrices.get(sale.inventoryItem.tcgplayerProductId)
                  : undefined;
              const market =
                live ?? sale.inventoryItem.marketPrice ?? null;
              return (
                <TableRow key={sale.id}>
                  <Td>
                    <div className="flex items-center gap-3">
                      <CardThumb
                        src={sale.inventoryItem.imageUrl}
                        alt={sale.inventoryItem.name}
                        size="sm"
                      />
                      <div className="font-semibold">
                        {itemDisplayLabel(sale.inventoryItem)}
                      </div>
                    </div>
                  </Td>
                  <Td className="text-muted">{formatDate(sale.saleDate)}</Td>
                  <Td className="text-sm">{receiverLabel(sale)}</Td>
                  <Td className="font-medium tabular-nums">
                    {formatCurrency(sale.salePrice)}
                  </Td>
                  <Td className="tabular-nums text-muted">
                    {formatCurrency(sale.platformFees + sale.shippingCost)}
                  </Td>
                  <Td className="tabular-nums">{formatCurrency(cost)}</Td>
                  <Td className="tabular-nums text-muted">
                    {market != null
                      ? formatCurrency(market * sale.inventoryItem.quantity)
                      : "—"}
                  </Td>
                  <Td>
                    <span
                      className={`inline-flex rounded-lg px-2 py-0.5 text-sm font-bold tabular-nums ${
                        profit >= 0
                          ? "bg-success-soft text-success"
                          : "bg-danger-soft text-danger"
                      }`}
                    >
                      {formatCurrency(profit)}
                    </span>
                  </Td>
                  <Td>
                    <DeleteButton
                      confirmMessage="Delete this sale and return the card to inventory?"
                      action={deleteSale.bind(null, sale.id)}
                    />
                  </Td>
                </TableRow>
              );
            })}
          </tbody>
        </Table>
      )}

      <div className="mt-8">
        <SectionHeader
          title="Collection withdrawals"
          description={`${collectionWithdrawals.length} card${
            collectionWithdrawals.length === 1 ? "" : "s"
          } moved to personal collections`}
        />
        {collectionWithdrawals.length === 0 ? (
          <EmptyState message="No cards moved to personal collections." />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Card</Th>
                <Th>Date</Th>
                <Th>Taken by</Th>
                <Th>Cost basis</Th>
                <Th>Settlement impact</Th>
                <Th></Th>
              </tr>
            </thead>
            <tbody>
              {collectionWithdrawals.map((withdrawal) => (
                <TableRow key={withdrawal.id}>
                  <Td>
                    <div className="flex items-center gap-3">
                      <CardThumb
                        src={withdrawal.inventoryItem.imageUrl}
                        alt={withdrawal.inventoryItem.name}
                        size="sm"
                      />
                      <span className="font-semibold">
                        {itemDisplayLabel(withdrawal.inventoryItem)}
                      </span>
                    </div>
                  </Td>
                  <Td className="text-muted">
                    {formatDate(withdrawal.date)}
                  </Td>
                  <Td>{withdrawal.takenBy.name}</Td>
                  <Td className="font-medium tabular-nums">
                    {formatCurrency(withdrawal.costBasis)}
                  </Td>
                  <Td className="text-sm text-muted">
                    Owes other partner{" "}
                    {formatCurrency(withdrawal.costBasis / 2)}
                  </Td>
                  <Td>
                    <DeleteButton
                      confirmMessage="Reverse this withdrawal and return the card to inventory?"
                      action={deleteCollectionWithdrawal.bind(
                        null,
                        withdrawal.id
                      )}
                    />
                  </Td>
                </TableRow>
              ))}
            </tbody>
          </Table>
        )}
      </div>
    </div>
  );
}
