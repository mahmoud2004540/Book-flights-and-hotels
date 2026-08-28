import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { AmountType, PrismaClient, ServiceType } from "@prisma/client";

/**
 * Seeds operational data: suppliers, markup rules and discount codes.
 * These are real settings, not fake data — demo users and bookings arrive in
 * stage 1, once authentication exists.
 */
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set — see .env.example.");
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const SUPPLIERS = [
  { id: "duffel", name: "Duffel", priority: 10, isActive: false },
  { id: "amadeus", name: "Amadeus Self-Service", priority: 20, isActive: true },
  { id: "travelpayouts", name: "Travelpayouts", priority: 30, isActive: false },
  { id: "bookingcom", name: "Booking.com Demand API", priority: 40, isActive: false },
] as const;

async function main(): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Seeding is not allowed in production.");
  }

  for (const s of SUPPLIERS) {
    await prisma.supplier.upsert({
      where: { id: s.id },
      update: { name: s.name, priority: s.priority },
      create: { ...s, config: {} },
    });
  }

  const defaultMarkup = Number(process.env.DEFAULT_MARKUP_PERCENT ?? 4.5);

  // A catch-all rule at low priority, beaten by anything more specific.
  await prisma.markupRule.upsert({
    where: { id: "default-markup" },
    update: { value: defaultMarkup },
    create: {
      id: "default-markup",
      type: AmountType.PERCENT,
      value: defaultMarkup,
      priority: 1000,
      isActive: true,
    },
  });

  // An example of a more specific rule: a lower margin on hotels, where the
  // supplier commission is already higher.
  await prisma.markupRule.upsert({
    where: { id: "hotels-markup" },
    update: {},
    create: {
      id: "hotels-markup",
      serviceType: ServiceType.HOTEL,
      type: AmountType.PERCENT,
      value: 3,
      priority: 500,
      isActive: true,
    },
  });

  await prisma.promoCode.upsert({
    where: { code: "WELCOME10" },
    update: {},
    create: {
      code: "WELCOME10",
      discountType: AmountType.PERCENT,
      value: 10,
      maxUses: 1000,
      minAmount: 1000,
      validFrom: new Date("2026-01-01T00:00:00Z"),
      validTo: new Date("2026-12-31T23:59:59Z"),
      isActive: true,
    },
  });

  console.log("Seeded: 4 suppliers, 2 markup rules, 1 discount code.");
}

main()
  .catch((error: unknown) => {
    console.error("Seeding failed:", error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
