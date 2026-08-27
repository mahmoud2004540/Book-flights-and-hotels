import "dotenv/config";
import { defineConfig } from "prisma/config";

/**
 * Prisma 7 configuration: the connection string no longer lives in
 * schema.prisma, and the CLI no longer loads .env on its own — hence the
 * explicit import on the first line.
 *
 * The url is deliberately optional here. `generate` needs no database, and
 * making the variable mandatory breaks `npm install` on any machine or build
 * server without a connection string. Only the migrate commands require it,
 * and they fail with a clear message when it is missing.
 */
const url = process.env.DATABASE_URL;

export default defineConfig({
  schema: "prisma/schema.prisma",
  ...(url ? { datasource: { url } } : {}),
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
});
