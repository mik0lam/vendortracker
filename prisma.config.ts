import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "npx tsx prisma/seed.ts",
  },
  datasource: {
    // Schema changes go over the direct (session) connection when available.
    url: process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"],
  },
});
