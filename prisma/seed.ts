import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set.");
const adapter = new PrismaPg(url);
const prisma = new PrismaClient({ adapter });

async function main() {
  const count = await prisma.partner.count();
  if (count === 0) {
    await prisma.partner.createMany({
      data: [
        { name: "Michael", splitPercent: 50 },
        { name: "Dillon", splitPercent: 50 },
      ],
    });
    console.log("Seeded default partners: Michael and Dillon");
    return;
  }

  const partners = await prisma.partner.findMany({ orderBy: { createdAt: "asc" } });
  const renames: Record<string, string> = { You: "Michael", Friend: "Dillon" };
  for (const partner of partners) {
    const next = renames[partner.name];
    if (next) {
      await prisma.partner.update({
        where: { id: partner.id },
        data: { name: next },
      });
      console.log(`Renamed ${partner.name} → ${next}`);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
