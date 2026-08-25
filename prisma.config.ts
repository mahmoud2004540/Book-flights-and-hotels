import "dotenv/config";
import { defineConfig, env } from "prisma/config";

/**
 * إعداد Prisma 7: رابط الاتصال لم يعد يُكتب في schema.prisma.
 * ولم يعد الـ CLI يحمّل ملف .env تلقائيًا، لذلك يُحمَّل صراحةً في أول سطر.
 * أوامر الترحيل والاستكشاف تقرأه من هنا، وعميل التطبيق يأخذه
 * عبر محوّل السائق في src/lib/prisma.ts.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("DATABASE_URL"),
  },
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
});
