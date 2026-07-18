import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const url = process.env.DATABASE_URL!;
const prisma = new PrismaClient({ adapter: new PrismaPg(url) });

async function main() {
  const partners = await prisma.partner.findMany({ orderBy: { name: "asc" } });
  console.log("Connected to Supabase Postgres");
  console.log("Partners:", partners.map((p) => p.name).join(", "));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
