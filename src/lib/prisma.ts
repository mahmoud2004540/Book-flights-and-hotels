import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

/**
 * One Prisma client per process, built on first use rather than on import.
 *
 * Lazy because Next evaluates every route module while it builds, and a client
 * constructed at import time makes DATABASE_URL a *build* requirement: the
 * build fails with "DATABASE_URL is not set" before a single request exists.
 * A connection string is a runtime secret, and needing it to compile means any
 * preview build without it — or any build that runs before the environment is
 * injected — dies for no reason.
 *
 * The Proxy also keeps the error where it belongs. A missing variable now
 * fails on the first query, naming the file to fix, instead of at import of
 * whichever module happened to be loaded first.
 *
 * Reused across reloads because fast refresh would otherwise open a new
 * connection on every save until Neon's limit is exhausted.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set — see .env.example.");
  }

  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

function client(): PrismaClient {
  const existing = globalForPrisma.prisma;
  if (existing) return existing;

  const created = createClient();
  // Cached in production too: a serverless instance handles many requests, and
  // one client per request would open one connection per request.
  globalForPrisma.prisma = created;
  return created;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, property, receiver) {
    return Reflect.get(client(), property, receiver);
  },
  has: (_target, property) => property in client(),
  ownKeys: () => Reflect.ownKeys(client()),
  getOwnPropertyDescriptor: (_target, property) =>
    Reflect.getOwnPropertyDescriptor(client(), property),
});
