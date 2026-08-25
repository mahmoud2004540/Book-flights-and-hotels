import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

/**
 * عميل Prisma واحد لكل عملية.
 * بدون هذا، إعادة التحميل السريع في التطوير تفتح اتصالًا جديدًا كل مرة
 * حتى ينفد سقف الاتصالات على Neon.
 *
 * Prisma 7 يمرّر رابط الاتصال عبر محوّل السائق لا عبر schema.prisma.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL غير معرّف — راجع ملف .env.example.");
  }

  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
