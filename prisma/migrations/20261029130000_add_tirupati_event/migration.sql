-- Creates the first event so the site is usable right after the first deploy.
INSERT INTO "Event" ("id", "slug", "name", "city", "state", "stateCode", "venue", "startDate", "days", "dayStart", "dayEnd", "slotMinutes", "tables", "sectors", "registrationOpen")
VALUES ('evt_tirupati_2026', 'tirupati-rbsm-2026', 'Tirupati RBSM 2026', 'Tirupati', 'Andhra Pradesh', 'AP', 'Venue to be announced', '2026-11-20', 2, '10:00', '17:00', 30, 15,
  ARRAY['Textiles', 'Pharmaceuticals & Medical Equipment', 'Electrical Components', 'Automobile & Automotive Components'], true)
ON CONFLICT ("slug") DO NOTHING;
