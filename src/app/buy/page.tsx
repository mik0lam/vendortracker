import Link from "next/link";
import { CalendarDays, MapPin, ShoppingBag } from "lucide-react";
import { CreateBuySessionForm } from "@/components/CreateBuySessionForm";
import {
  Card,
  EmptyState,
  PageHeader,
  SectionHeader,
  StatCard,
} from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/format";
import { lineTotal } from "@/lib/buy-summary";
import { prisma } from "@/lib/db";
import { getOwnerId } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function BuyPage() {
  const ownerId = await getOwnerId();
  const sessions = await prisma.buySession.findMany({
    where: { ownerId },
    include: {
      items: true,
    },
    orderBy: { date: "desc" },
  });

  const totalShows = sessions.length;
  const totalSpentAll = sessions.reduce(
    (sum, s) => sum + s.items.reduce((a, i) => a + lineTotal(i), 0),
    0
  );

  return (
    <div>
      <PageHeader
        title="Show buys"
        description="Track cards bought and traded at a show, including who paid and what enters shared inventory."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <StatCard
          label="Show days logged"
          value={String(totalShows)}
          tone="indigo"
          icon={<CalendarDays className="h-[18px] w-[18px]" />}
        />
        <StatCard
          label="Total spent at shows"
          value={formatCurrency(totalSpentAll)}
          tone="amber"
          icon={<ShoppingBag className="h-[18px] w-[18px]" />}
        />
      </div>

      <Card hover className="mb-8">
        <SectionHeader
          title="New show day"
          description="Start a session when you arrive at a card show"
        />
        <CreateBuySessionForm />
      </Card>

      <SectionHeader
        title="Past show days"
        description={
          sessions.length === 0
            ? "No shows yet"
            : `${sessions.length} show${sessions.length === 1 ? "" : "s"}`
        }
      />

      {sessions.length === 0 ? (
        <EmptyState
          message="Start a show day above to log purchases as you buy cards."
          icon={<ShoppingBag className="h-5 w-5" />}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {sessions.map((session) => {
            const total = session.items.reduce(
              (sum, i) => sum + lineTotal(i),
              0
            );
            const shared = session.items.filter((i) => i.allocation === "shared");
            const personal = session.items.filter(
              (i) => i.allocation === "personal"
            );

            return (
              <Link key={session.id} href={`/buy/${session.id}`}>
                <Card hover className="h-full transition hover:border-primary/30">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold">{session.name}</h3>
                      <p className="mt-1 text-sm text-muted">
                        {formatDate(session.date)}
                      </p>
                      {session.location ? (
                        <p className="mt-1 flex items-center gap-1 text-xs text-muted">
                          <MapPin className="h-3 w-3" />
                          {session.location}
                        </p>
                      ) : null}
                    </div>
                    <p className="text-lg font-bold tabular-nums text-primary">
                      {formatCurrency(total)}
                    </p>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full bg-primary-soft px-2.5 py-1 font-medium text-indigo-700">
                      {session.items.length} cards
                    </span>
                    <span className="rounded-full bg-success-soft px-2.5 py-1 font-medium text-success">
                      {shared.length} shared
                    </span>
                    <span className="rounded-full bg-accent-soft px-2.5 py-1 font-medium text-amber-700">
                      {personal.length} collection
                    </span>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
