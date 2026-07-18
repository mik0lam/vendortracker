import Link from "next/link";
import { PackageSearch } from "lucide-react";
import { deleteInventoryItem } from "@/app/actions";
import { InventoryForm } from "@/components/InventoryForm";
import { SaleForm } from "@/components/SaleForm";
import { DeleteButton } from "@/components/DeleteButton";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  FilterBar,
  Input,
  PageHeader,
  SectionHeader,
  Select,
  Table,
  TableRow,
  Td,
  Th,
} from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/format";
import { itemDisplayLabel } from "@/lib/item-label";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; sell?: string }>;
}) {
  const params = await searchParams;
  const status = params.status ?? "in_stock";
  const q = (params.q ?? "").trim().toLowerCase();
  const sellId = params.sell;

  const items = await prisma.inventoryItem.findMany({
    orderBy: { purchaseDate: "desc" },
    include: { sale: true },
  });

  const filtered = items.filter((item) => {
    if (status !== "all" && item.status !== status) return false;
    if (!q) return true;
    const haystack = [
      item.name,
      item.setName,
      item.cardNumber,
      item.condition,
      item.gradeCompany,
      item.grade,
      item.certNumber,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });

  const inStockOptions = items
    .filter((i) => i.status === "in_stock")
    .map((i) => ({
      id: i.id,
      name: i.name,
      unitCost: i.unitCost,
      label: `${itemDisplayLabel(i)} · cost ${formatCurrency(i.unitCost)}`,
    }));

  return (
    <div>
      <PageHeader
        title="Inventory"
        description="Track each physical card with cost basis. Mark sold when it ships."
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <Card hover>
          <SectionHeader title="Add purchase" description="Log a new card purchase" />
          <InventoryForm />
        </Card>
        <Card hover>
          <SectionHeader title="Record sale" description="Sell from in-stock inventory" />
          <SaleForm items={inStockOptions} defaultItemId={sellId} />
        </Card>
      </div>

      <div className="mt-8">
        <SectionHeader
          title="All cards"
          description={`${filtered.length} item${filtered.length === 1 ? "" : "s"} shown`}
        />

        <FilterBar>
          <form className="flex w-full flex-wrap items-end gap-3">
            <Field label="Status" htmlFor="status">
              <Select id="status" name="status" defaultValue={status}>
                <option value="in_stock">In stock</option>
                <option value="sold">Sold</option>
                <option value="all">All</option>
              </Select>
            </Field>
            <Field label="Search" htmlFor="q">
              <Input
                id="q"
                name="q"
                defaultValue={params.q ?? ""}
                placeholder="Name, set, cert..."
              />
            </Field>
            <Button type="submit">Filter</Button>
          </form>
        </FilterBar>

        {filtered.length === 0 ? (
          <EmptyState
            message="No inventory items match this filter."
            icon={<PackageSearch className="h-5 w-5" />}
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Card</Th>
                <Th>Details</Th>
                <Th>Purchased</Th>
                <Th>Cost</Th>
                <Th>Status</Th>
                <Th>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <TableRow key={item.id}>
                  <Td>
                    <div className="font-semibold">{item.name}</div>
                    {item.setName ? (
                      <div className="text-xs text-muted">{item.setName}</div>
                    ) : null}
                  </Td>
                  <Td>
                    {item.cardType === "graded" ? (
                      <Badge variant="indigo">
                        {item.gradeCompany} {item.grade}
                      </Badge>
                    ) : (
                      <Badge>{item.condition ?? "Raw"}</Badge>
                    )}
                    {item.certNumber ? (
                      <div className="mt-1 text-xs text-muted">#{item.certNumber}</div>
                    ) : null}
                    {item.cardNumber ? (
                      <div className="text-xs text-muted">Card #{item.cardNumber}</div>
                    ) : null}
                  </Td>
                  <Td className="text-muted">{formatDate(item.purchaseDate)}</Td>
                  <Td className="font-medium tabular-nums">
                    {formatCurrency(item.unitCost * item.quantity)}
                  </Td>
                  <Td>
                    <Badge variant={item.status === "in_stock" ? "success" : "muted"}>
                      {item.status === "in_stock" ? "In stock" : "Sold"}
                    </Badge>
                  </Td>
                  <Td>
                    <div className="flex flex-wrap gap-2">
                      {item.status === "in_stock" ? (
                        <>
                          <Link
                            href={`/inventory?sell=${item.id}&status=in_stock`}
                            className="inline-flex items-center rounded-lg border border-border bg-white px-2.5 py-1.5 text-xs font-medium shadow-sm transition hover:border-primary/30 hover:bg-primary-soft/50 hover:text-primary"
                          >
                            Mark sold
                          </Link>
                          <DeleteButton
                            confirmMessage={`Delete "${item.name}" from inventory?`}
                            action={deleteInventoryItem.bind(null, item.id)}
                          />
                        </>
                      ) : (
                        <Link
                          href="/sales"
                          className="text-xs font-medium text-primary hover:underline"
                        >
                          View sales
                        </Link>
                      )}
                    </div>
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
