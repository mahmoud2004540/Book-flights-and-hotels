import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { AmountType, PrismaClient, ServiceType } from "@prisma/client";

/**
 * بذرة بيانات التشغيل: المزوّدون وقواعد الهامش وأكواد الخصم.
 * هذه إعدادات حقيقية لا بيانات وهمية — المستخدمون والحجوزات التجريبية
 * تُضاف في المرحلة 1 بعد اكتمال المصادقة.
 */
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL غير معرّف — راجع ملف .env.example.");
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const SUPPLIERS = [
  { id: "amadeus", name: "Amadeus Self-Service", priority: 10, isActive: true },
  { id: "travelpayouts", name: "Travelpayouts", priority: 20, isActive: false },
  { id: "duffel", name: "Duffel", priority: 30, isActive: false },
  { id: "bookingcom", name: "Booking.com Demand API", priority: 40, isActive: false },
] as const;

async function main(): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("البذر ممنوع في الإنتاج.");
  }

  for (const s of SUPPLIERS) {
    await prisma.supplier.upsert({
      where: { id: s.id },
      update: { name: s.name, priority: s.priority },
      create: { ...s, config: {} },
    });
  }

  const defaultMarkup = Number(process.env.DEFAULT_MARKUP_PERCENT ?? 4.5);

  // قاعدة عامة بأولوية منخفضة، تغلبها أي قاعدة أكثر تحديدًا.
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

  // مثال لقاعدة أكثر تحديدًا: هامش أقل على الفنادق لأن عمولتها أعلى أصلًا.
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

  console.log("تم البذر: 4 مزوّدين، قاعدتا هامش، كود خصم واحد.");
}

main()
  .catch((error: unknown) => {
    console.error("فشل البذر:", error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
