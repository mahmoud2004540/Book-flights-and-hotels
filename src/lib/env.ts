import { z } from "zod";

/**
 * Environment validation at boot.
 * Failing here is deliberate: starting with an incomplete configuration fails
 * later in a much more obscure way.
 */
const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url("DATABASE_URL must be a valid connection string"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  DEFAULT_MARKUP_PERCENT: z.coerce.number().min(0).max(100).default(4.5),
  /** The mock adapter — tests only, and refused in production (section 15). */
  SUPPLIER_MOCK_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  /** The mock payment provider — tests only, and refused in production. */
  PAYMENT_MOCK_ENABLED: z
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
    throw new Error(`Invalid environment configuration:\n${details}`);
  }

  if (parsed.data.SUPPLIER_MOCK_ENABLED && parsed.data.NODE_ENV === "production") {
    throw new Error(
      "SUPPLIER_MOCK_ENABLED=true is not allowed in production — the mock adapter is for tests only.",
    );
  }

  if (parsed.data.PAYMENT_MOCK_ENABLED && parsed.data.NODE_ENV === "production") {
    throw new Error(
      "PAYMENT_MOCK_ENABLED=true is not allowed in production — no real payment may go through the mock.",
    );
  }

  cached = parsed.data;
  return cached;
}
