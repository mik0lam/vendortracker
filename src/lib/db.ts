import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pgPool: Pool | undefined;
};

function createPrismaClient() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Add your Supabase Postgres connection string."
    );
  }

  // Supabase + Vercel: use the pooler URL (IPv4). Direct db.*.supabase.co is
  // often IPv6-only and fails from Vercel. SSL is required; rejectUnauthorized
  // avoids self-signed chain failures with the pooler.
  const pool =
    globalForPrisma.pgPool ??
    new Pool({
      connectionString: url,
      ssl: url.includes("localhost")
        ? undefined
        : { rejectUnauthorized: false },
      max: 1,
    });

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.pgPool = pool;
  }

  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
