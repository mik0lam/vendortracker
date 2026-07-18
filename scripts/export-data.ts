/**
 * Dumps every table from the current database to prisma/backup.json.
 * Run BEFORE switching providers: npx tsx scripts/export-data.ts
 */
import "dotenv/config";
import { writeFileSync } from "node:fs";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./prisma/dev.db",
});
const prisma = new PrismaClient({ adapter });

async function main() {
  const data = {
    partners: await prisma.partner.findMany(),
    inventoryItems: await prisma.inventoryItem.findMany(),
    sales: await prisma.sale.findMany(),
    expenses: await prisma.expense.findMany(),
    contributions: await prisma.contribution.findMany(),
    buySessions: await prisma.buySession.findMany(),
    buyLineItems: await prisma.buyLineItem.findMany(),
  };

  writeFileSync("prisma/backup.json", JSON.stringify(data, null, 2));

  for (const [table, rows] of Object.entries(data)) {
    console.log(`${table}: ${rows.length} rows`);
  }
  console.log("\nSaved to prisma/backup.json");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
