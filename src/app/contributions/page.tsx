import { HandCoins } from "lucide-react";
import { deleteContribution, updatePartnerName } from "@/app/actions";
import { ContributionForm } from "@/components/ContributionForm";
import { DeleteButton } from "@/components/DeleteButton";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
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

export default async function ContributionsPage() {
  const ownerId = await getOwnerId();
  const [partners, contributions] = await Promise.all([
    getPartners(ownerId),
    prisma.contribution.findMany({
      where: { ownerId },
      include: { partner: true },
      orderBy: { date: "desc" },
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="Contributions"
        description="Log cash each partner puts into or takes out of the shared pool."
      />

      <div className="mb-8 grid gap-5 lg:grid-cols-2">
        <Card hover>
          <SectionHeader
            title="Add contribution"
            description="Money in or withdrawal out"
          />
          <ContributionForm
            partners={partners.map((p) => ({ id: p.id, name: p.name }))}
          />
        </Card>
        <Card>
          <SectionHeader
            title="Partner names"
            description="Rename defaults so reports match your business"
          />
          <div className="space-y-3">
            {partners.map((partner) => (
              <form
                key={partner.id}
                action={updatePartnerName}
                className="flex flex-wrap items-end gap-2 rounded-xl border border-border/60 bg-card-muted p-3"
              >
                <input type="hidden" name="id" value={partner.id} />
                <div className="min-w-[12rem] flex-1">
                  <Input
                    name="name"
                    defaultValue={partner.name}
                    required
                    aria-label={`Name for partner ${partner.name}`}
                  />
                </div>
                <Button type="submit" variant="secondary" size="sm">
                  Save
                </Button>
              </form>
            ))}
          </div>
        </Card>
      </div>

      <SectionHeader
        title="Contribution history"
        description={`${contributions.length} entr${contributions.length === 1 ? "y" : "ies"}`}
      />

      {contributions.length === 0 ? (
        <EmptyState
          message="No contributions logged yet."
          icon={<HandCoins className="h-5 w-5" />}
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Date</Th>
              <Th>Partner</Th>
              <Th>Type</Th>
              <Th>Amount</Th>
              <Th>Note</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {contributions.map((c) => (
              <TableRow key={c.id}>
                <Td className="text-muted">{formatDate(c.date)}</Td>
                <Td className="font-medium">{c.partner.name}</Td>
                <Td>
                  <Badge variant={c.amount >= 0 ? "success" : "muted"}>
                    {c.amount >= 0 ? "In" : "Out"}
                  </Badge>
                </Td>
                <Td
                  className={`font-semibold tabular-nums ${
                    c.amount >= 0 ? "text-success" : "text-danger"
                  }`}
                >
                  {formatCurrency(Math.abs(c.amount))}
                </Td>
                <Td className="max-w-xs truncate text-muted">{c.note ?? "—"}</Td>
                <Td>
                  <DeleteButton
                    confirmMessage="Delete this contribution?"
                    action={deleteContribution.bind(null, c.id)}
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
