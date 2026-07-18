import { ExternalLink, PackageSearch } from "lucide-react";
import { deleteInventoryItem } from "@/app/actions";
import { InventoryForm } from "@/components/InventoryForm";
import { DeleteButton } from "@/components/DeleteButton";
import { CardThumb } from "@/components/CardThumb";
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
import { prisma } from "@/lib/db";
import { getOwnerId } from "@/lib/auth";
import { getPartners } from "@/lib/partners";
import { tcgplayerUrlFor } from "@/lib/tcgplayer";
import { fetchMarketPricesForGroups } from "@/lib/tcgcsv";

export const dynamic = "force-dynamic";

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const params = await searchParams;
  const status = params.status ?? "in_stock";
  const q = (params.q ?? "").trim().toLowerCase();

  const ownerId = await getOwnerId();
  const [items, partners] = await Promise.all([
    prisma.inventoryItem.findMany({
      where: { ownerId },
      orderBy: { purchaseDate: "desc" },
      include: { sale: true, paidBy: true },
    }),
    getPartners(ownerId),
  ]);

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

  const groupIds = filtered
    .filter((i) => i.tcgplayerGroupId != null)
    .map((i) => ({
      groupId: i.tcgplayerGroupId as number,
      language: i.language,
    }));
  const livePrices = await fetchMarketPricesForGroups(groupIds);

  return (
    <div>
      <PageHeader
        title="Inventory"
        description="Track each physical card with cost basis. Record sales on the Sales page."
      />

      <Card hover>
        <SectionHeader title="Add purchase" description="Log a new card purchase" />
        <InventoryForm
          partners={partners.map((partner) => ({
            id: partner.id,
            name: partner.name,
          }))}
        />
      </Card>

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
                <option value="personal">Personal collection</option>
                <option value="traded">Traded</option>
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
                <Th>Paid by</Th>
                <Th>Cost</Th>
                <Th>TCG market</Th>
                <Th>Status</Th>
                <Th>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => {
                const live =
                  item.tcgplayerProductId != null
                    ? livePrices.get(item.tcgplayerProductId)
                    : undefined;
                const market = live ?? item.marketPrice ?? null;
                const cost = item.unitCost * item.quantity;
                const delta =
                  market != null ? market * item.quantity - cost : null;
                return (
                  <TableRow key={item.id}>
                    <Td>
                      <div className="flex items-center gap-3">
                        <CardThumb src={item.imageUrl} alt={item.name} />
                        <div>
                          <div className="font-semibold">{item.name}</div>
                          {item.setName ? (
                            <div className="text-xs text-muted">{item.setName}</div>
                          ) : null}
                        </div>
                      </div>
                    </Td>
                    <Td>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {item.cardType === "graded" ? (
                          <Badge variant="indigo">
                            {item.gradeCompany} {item.grade}
                          </Badge>
                        ) : (
                          <Badge>{item.condition ?? "Raw"}</Badge>
                        )}
                        {item.language === "ja" ? (
                          <Badge variant="warning">JP</Badge>
                        ) : null}
                      </div>
                      {item.certNumber ? (
                        <div className="mt-1 text-xs text-muted">
                          #{item.certNumber}
                        </div>
                      ) : null}
                      {item.cardNumber ? (
                        <div className="text-xs text-muted">
                          Card #{item.cardNumber}
                        </div>
                      ) : null}
                    </Td>
                    <Td className="text-muted">
                      {formatDate(item.purchaseDate)}
                    </Td>
                    <Td className="text-sm text-muted">
                      {item.paidBy?.name ?? "Shared pool"}
                    </Td>
                    <Td className="font-medium tabular-nums">
                      {formatCurrency(cost)}
                    </Td>
                    <Td>
                      {market != null ? (
                        <div>
                          <div className="font-medium tabular-nums">
                            {formatCurrency(market * item.quantity)}
                          </div>
                          {delta != null ? (
                            <div
                              className={`text-xs tabular-nums ${
                                delta >= 0 ? "text-success" : "text-danger"
                              }`}
                            >
                              {delta >= 0 ? "+" : ""}
                              {formatCurrency(delta)} vs cost
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </Td>
                    <Td>
                      <Badge
                        variant={
                          item.status === "in_stock"
                            ? "success"
                            : item.status === "traded"
                              ? "indigo"
                              : "muted"
                        }
                      >
                        {item.status === "in_stock"
                          ? "In stock"
                          : item.status === "sold"
                            ? "Sold"
                            : item.status === "traded"
                              ? "Traded"
                              : "Personal"}
                      </Badge>
                    </Td>
                    <Td>
                      <div className="flex flex-wrap gap-2">
                        <a
                          href={tcgplayerUrlFor(item)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg border border-border bg-white px-2.5 py-1.5 text-xs font-medium shadow-sm transition hover:border-primary/30 hover:bg-primary-soft/50 hover:text-primary"
                        >
                          TCGplayer
                          <ExternalLink
                            className="h-3 w-3"
                            aria-hidden="true"
                          />
                        </a>
                        {item.status === "in_stock" ? (
                          <DeleteButton
                            confirmMessage={`Delete "${item.name}" from inventory?`}
                            action={deleteInventoryItem.bind(null, item.id)}
                          />
                        ) : null}
                      </div>
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
