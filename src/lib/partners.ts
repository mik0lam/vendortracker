import { prisma } from "@/lib/db";

/**
 * Returns the account's partners, creating the default pair on first use so
 * new accounts can start recording buys/sales immediately. Names can be
 * changed on the Contributions page.
 */
export async function getPartners(ownerId: string) {
  const existing = await prisma.partner.findMany({
    where: { ownerId },
    orderBy: { createdAt: "asc" },
  });
  if (existing.length > 0) return existing;

  const first = await prisma.partner.create({
    data: { ownerId, name: "Partner 1", splitPercent: 50 },
  });
  const second = await prisma.partner.create({
    data: { ownerId, name: "Partner 2", splitPercent: 50 },
  });
  return [first, second];
}
