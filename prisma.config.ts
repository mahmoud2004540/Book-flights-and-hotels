import "dotenv/config";
import { defineConfig } from "prisma/config";

/**
 * إعداد Prisma 7: رابط الاتصال لم يعد يُكتب في schema.prisma.
 * ولم يعد الـ CLI يحمّل ملف .env تلقائيًا، لذلك يُحمَّل صراحةً في أول سطر.
 *
 * الرابط اختياري هنا عن قصد: أمر generate لا يحتاج قاعدة بيانات، وربطه
 * بمتغيّر إجباري يكسر `npm install` على أي جهاز أو خادم بناء لا يملك الرابط.
 * أوامر الترحيل وحدها هي التي تطلبه، وتفشل برسالة واضحة إن غاب.
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
