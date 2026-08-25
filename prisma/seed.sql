-- بذر بيانات التشغيل بصيغة SQL — نسخة مكافئة لـ prisma/seed.ts
-- الغرض: تشغيل البذر من محرّر SQL في المتصفح (Neon SQL Editor) بدون ترمينال.
-- الأمر آمن للتكرار: تشغيله أكثر من مرة لا يُنشئ صفوفًا مكرّرة.

-- المزوّدون. Amadeus وحده مفعّل — الباقي يُفعَّل في مرحلته.
INSERT INTO "suppliers" ("id", "name", "isActive", "priority", "config") VALUES
  ('amadeus',       'Amadeus Self-Service',   true,  10, '{}'),
  ('travelpayouts', 'Travelpayouts',          false, 20, '{}'),
  ('duffel',        'Duffel',                 false, 30, '{}'),
  ('bookingcom',    'Booking.com Demand API', false, 40, '{}')
ON CONFLICT ("id") DO UPDATE
  SET "name" = EXCLUDED."name",
      "priority" = EXCLUDED."priority";

-- قواعد الهامش. الأقل رقمًا في priority يفوز، فالقاعدة الأكثر تحديدًا تغلب العامة.
INSERT INTO "markup_rules" ("id", "supplierId", "serviceType", "destination", "type", "value", "priority", "isActive") VALUES
  ('default-markup', NULL, NULL,               NULL, 'PERCENT'::"AmountType", 4.50, 1000, true),
  ('hotels-markup',  NULL, 'HOTEL'::"ServiceType", NULL, 'PERCENT'::"AmountType", 3.00,  500, true)
ON CONFLICT ("id") DO UPDATE
  SET "value" = EXCLUDED."value",
      "priority" = EXCLUDED."priority";

-- كود خصم ترحيبي.
INSERT INTO "promo_codes" ("id", "code", "discountType", "value", "maxUses", "usedCount", "minAmount", "validFrom", "validTo", "isActive") VALUES
  ('promo-welcome10', 'WELCOME10', 'PERCENT'::"AmountType", 10.00, 1000, 0, 1000.00,
   '2026-01-01T00:00:00Z', '2026-12-31T23:59:59Z', true)
ON CONFLICT ("code") DO NOTHING;

-- تحقّق: المفروض يرجّع 4 مزوّدين، وقاعدتَي هامش، وكود خصم واحد.
SELECT 'suppliers' AS "الجدول", count(*) AS "عدد الصفوف" FROM "suppliers"
UNION ALL SELECT 'markup_rules', count(*) FROM "markup_rules"
UNION ALL SELECT 'promo_codes',  count(*) FROM "promo_codes";
