-- Tariffs from 19.11.2026: 7 / 14 / 30 / 90 / 180 / 365 days. USDT (TON) only.
ALTER TABLE "Plan" ADD COLUMN "description" TEXT;

INSERT INTO "Plan" ("id", "code", "name", "description", "durationDays", "priceUsd", "originalPriceUsd", "maxDevices", "isActive", "createdAt", "updatedAt") VALUES
  (gen_random_uuid()::text, 'pro_7d',      'Sali Pro · 7 дней',  'Недельное использование', 7,   1.20,  NULL, 3, true, NOW(), NOW()),
  (gen_random_uuid()::text, 'pro_14d',     'Sali Pro · 14 дней', 'Две недели',              14,  2.00,  NULL, 3, true, NOW(), NOW()),
  (gen_random_uuid()::text, 'pro_monthly', 'Sali Pro · 30 дней', 'Основная подписка',       30,  3.00,  NULL, 3, true, NOW(), NOW()),
  (gen_random_uuid()::text, 'pro_90d',     'Sali Pro · 90 дней', 'Постоянные пользователи', 90,  8.00,  NULL, 3, true, NOW(), NOW()),
  (gen_random_uuid()::text, 'pro_180d',    'Sali Pro · полгода', 'Полгода',                 180, 15.00, NULL, 3, true, NOW(), NOW()),
  (gen_random_uuid()::text, 'pro_yearly',  'Sali Pro · год',     'Год',                     365, 30.00, NULL, 3, true, NOW(), NOW())
ON CONFLICT ("code") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "durationDays" = EXCLUDED."durationDays",
  "priceUsd" = EXCLUDED."priceUsd",
  "originalPriceUsd" = EXCLUDED."originalPriceUsd",
  "isActive" = true,
  "updatedAt" = NOW();
