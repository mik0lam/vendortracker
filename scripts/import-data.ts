/**
 * Loads prisma/backup.json (created by scripts/export-data.ts) into the
 * database that DATABASE_URL points at. Safe to run once after switching
 * to Supabase Postgres: npx tsx scripts/import-data.ts
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set.");
const adapter = new PrismaPg(url);
const prisma = new PrismaClient({ adapter });

type Backup = {
  partners: any[];
  inventoryItems: any[];
  sales: any[];
  expenses: any[];
  contributions: any[];
  buySessions: any[];
  buyLineItems: any[];
};

async function main() {
  const backup: Backup = JSON.parse(readFileSync("prisma/backup.json", "utf8"));

  const existing = await prisma.partner.count();
  if (existing > 0) {
    console.log(
      "Target database already has partners — skipping import to avoid duplicates.\n" +
        "If you want a clean import, wipe the tables in Supabase first."
    );
    return;
  }

  // Insert in dependency order (parents before children).
  await prisma.partner.createMany({ data: backup.partners });
  await prisma.inventoryItem.createMany({ data: backup.inventoryItems });
  await prisma.sale.createMany({ data: backup.sales });
  await prisma.expense.createMany({ data: backup.expenses });
  await prisma.contribution.createMany({ data: backup.contributions });
  await prisma.buySession.createMany({ data: backup.buySessions });
  await prisma.buyLineItem.createMany({ data: backup.buyLineItems });

  for (const [table, rows] of Object.entries(backup)) {
    console.log(`${table}: imported ${rows.length} rows`);
  }
  console.log("\nDone. Your data is now in Supabase.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
