import { Receipt } from "lucide-react";
import { deleteSale } from "@/app/actions";
import { DeleteButton } from "@/components/DeleteButton";
import { SaleForm } from "@/components/SaleForm";
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
import { saleNetProfit } from "@/lib/calculations";
import { formatCurrency, formatDate } from "@/lib/format";
import { itemDisplayLabel } from "@/lib/item-label";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function SalesPage() {
  const [sales, inStock] = await Promise.all([
    prisma.sale.findMany({
      include: { inventoryItem: true },
      orderBy: { saleDate: "desc" },
    }),
    prisma.inventoryItem.findMany({
      where: { status: "in_stock" },
      orderBy: { purchaseDate: "desc" },
    }),
  ]);

  const options = inStock.map((i) => ({
    id: i.id,
    name: i.name,
    unitCost: i.unitCost,
    label: `${itemDisplayLabel(i)} · cost ${formatCurrency(i.unitCost)}`,
  }));

  return (
    <div>
      <PageHeader
        title="Sales"
        description="Sale history with net profit after cost, fees, and shipping."
      />

      <Card hover className="mb-8">
        <SectionHeader title="Record sale" description="Select a card and enter sale details" />
        <SaleForm items={options} />
      </Card>

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
              <Th>Sale price</Th>
              <Th>Fees + ship</Th>
              <Th>Cost</Th>
              <Th>Net profit</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {sales.map((sale) => {
              const cost =
                sale.inventoryItem.unitCost * sale.inventoryItem.quantity;
              const profit = saleNetProfit(sale);
              return (
                <TableRow key={sale.id}>
                  <Td>
                    <div className="font-semibold">
                      {itemDisplayLabel(sale.inventoryItem)}
                    </div>
                  </Td>
                  <Td className="text-muted">{formatDate(sale.saleDate)}</Td>
                  <Td className="font-medium tabular-nums">
                    {formatCurrency(sale.salePrice)}
                  </Td>
                  <Td className="tabular-nums text-muted">
                    {formatCurrency(sale.platformFees + sale.shippingCost)}
                  </Td>
                  <Td className="tabular-nums">{formatCurrency(cost)}</Td>
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
    </div>
  );
}
