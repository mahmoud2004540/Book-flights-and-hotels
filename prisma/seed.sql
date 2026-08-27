-- Operational seed data as SQL — equivalent to prisma/seed.ts.
-- Purpose: seeding from a hosted SQL editor (Neon) with no local toolchain.
-- Safe to re-run: running it more than once creates no duplicate rows.

-- Suppliers. Only Amadeus is enabled; the rest are enabled in their stage.
INSERT INTO "suppliers" ("id", "name", "isActive", "priority", "config") VALUES
  ('amadeus',       'Amadeus Self-Service',   true,  10, '{}'),
  ('travelpayouts', 'Travelpayouts',          false, 20, '{}'),
  ('duffel',        'Duffel',                 false, 30, '{}'),
  ('bookingcom',    'Booking.com Demand API', false, 40, '{}')
ON CONFLICT ("id") DO UPDATE
  SET "name" = EXCLUDED."name",
      "priority" = EXCLUDED."priority";

-- Markup rules. Lower priority wins, so a specific rule beats the catch-all.
INSERT INTO "markup_rules" ("id", "supplierId", "serviceType", "destination", "type", "value", "priority", "isActive") VALUES
  ('default-markup', NULL, NULL,                   NULL, 'PERCENT'::"AmountType", 4.50, 1000, true),
  ('hotels-markup',  NULL, 'HOTEL'::"ServiceType", NULL, 'PERCENT'::"AmountType", 3.00,  500, true)
ON CONFLICT ("id") DO UPDATE
  SET "value" = EXCLUDED."value",
      "priority" = EXCLUDED."priority";

-- A welcome discount code.
INSERT INTO "promo_codes" ("id", "code", "discountType", "value", "maxUses", "usedCount", "minAmount", "validFrom", "validTo", "isActive") VALUES
  ('promo-welcome10', 'WELCOME10', 'PERCENT'::"AmountType", 10.00, 1000, 0, 1000.00,
   '2026-01-01T00:00:00Z', '2026-12-31T23:59:59Z', true)
ON CONFLICT ("code") DO NOTHING;

-- Check: this should return 4 suppliers, 2 markup rules and 1 discount code.
SELECT 'suppliers' AS "table", count(*) AS "rows" FROM "suppliers"
UNION ALL SELECT 'markup_rules', count(*) FROM "markup_rules"
UNION ALL SELECT 'promo_codes',  count(*) FROM "promo_codes";
