// Creates the Tirupati RBSM 2026 event if it doesn't exist. Run with: npm run db:seed
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

await db.event.upsert({
  where: { slug: "tirupati-rbsm-2026" },
  update: {},
  create: {
    slug: "tirupati-rbsm-2026",
    name: "Tirupati RBSM 2026",
    city: "Tirupati",
    state: "Andhra Pradesh",
    stateCode: "AP",
    venue: "Venue to be announced",
    startDate: "2026-11-20",
    days: 2,
    dayStart: "10:00",
    dayEnd: "17:00",
    slotMinutes: 30,
    tables: 15,
    sectors: [
      "Textiles",
      "Pharmaceuticals & Medical Equipment",
      "Electrical Components",
      "Automobile & Automotive Components",
    ],
  },
});
console.log("Seeded Tirupati RBSM 2026");
await db.$disconnect();
