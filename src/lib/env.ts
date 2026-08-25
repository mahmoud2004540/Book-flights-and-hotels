import { z } from "zod";

/**
 * التحقق من متغيّرات البيئة عند الإقلاع.
 * الفشل هنا مقصود: تشغيل التطبيق بإعداد ناقص يفشل لاحقًا بشكل أغمض بكثير.
 */
const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url("DATABASE_URL يجب أن يكون رابط اتصال صالحًا"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  DEFAULT_MARKUP_PERCENT: z.coerce.number().min(0).max(100).default(4.5),
  /** المحوّل الوهمي — للاختبارات فقط، ويُرفض في الإنتاج (القسم 15). */
  SUPPLIER_MOCK_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
});

export type ServerEnv = z.infer<typeof serverSchema>;

let cached: ServerEnv | undefined;

export function getServerEnv(): ServerEnv {
  if (cached) return cached;

  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`إعداد البيئة غير صالح:\n${details}`);
  }

  if (parsed.data.SUPPLIER_MOCK_ENABLED && parsed.data.NODE_ENV === "production") {
    throw new Error(
      "SUPPLIER_MOCK_ENABLED=true ممنوع في الإنتاج — المحوّل الوهمي للاختبارات فقط.",
    );
  }

  cached = parsed.data;
  return cached;
}
