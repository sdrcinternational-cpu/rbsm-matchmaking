// Pure business rules shared by server actions and tests. No database access here.

export const UDYAM_RE = /^UDYAM-([A-Z]{2})-\d{2}-\d{7}$/;
export const IEC_RE = /^[A-Z0-9]{10}$/;

export function normaliseUdyam(v: string) {
  return v.trim().toUpperCase().replace(/\s+/g, "");
}

export function normaliseIec(v: string) {
  return v.trim().toUpperCase();
}

/** Returns an error message, or null when the seller's numbers are acceptable for this state. */
export function checkSellerIds(udyam: string, iec: string, stateCode: string, stateName: string): string | null {
  const m = UDYAM_RE.exec(udyam);
  if (!m) return "Enter the Udyam number in the format UDYAM-XX-00-0000000.";
  if (m[1] !== stateCode)
    return `This event is for ${stateName} MSMEs. Your Udyam number must start with UDYAM-${stateCode}.`;
  if (!IEC_RE.test(iec)) return "The IEC code must be 10 letters or digits.";
  return null;
}

export type EventTiming = {
  startDate: string;
  days: number;
  dayStart: string;
  dayEnd: string;
  slotMinutes: number;
};

export function eventDates(e: Pick<EventTiming, "startDate" | "days">): string[] {
  const out: string[] = [];
  const [y, m, d] = e.startDate.split("-").map(Number);
  for (let i = 0; i < e.days; i++) {
    const dt = new Date(Date.UTC(y, m - 1, d + i));
    out.push(dt.toISOString().slice(0, 10));
  }
  return out;
}

const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
const toHHMM = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

export function dayTimes(e: Pick<EventTiming, "dayStart" | "dayEnd" | "slotMinutes">): string[] {
  const out: string[] = [];
  for (let m = toMin(e.dayStart); m + e.slotMinutes <= toMin(e.dayEnd); m += e.slotMinutes) out.push(toHHMM(m));
  return out;
}

export type Slot = { date: string; time: string };
export type Booking = { fromId: string; toId: string; slotDate: string; slotTime: string; table: number };

/** Slots where neither participant already has a meeting and at least one table is free. */
export function freeSlots(e: EventTiming & { tables: number }, bookings: Booking[], a: string, b: string): Slot[] {
  const out: Slot[] = [];
  for (const date of eventDates(e)) {
    for (const time of dayTimes(e)) {
      const at = bookings.filter((r) => r.slotDate === date && r.slotTime === time);
      if (at.length >= e.tables) continue;
      if (at.some((r) => r.fromId === a || r.toId === a || r.fromId === b || r.toId === b)) continue;
      out.push({ date, time });
    }
  }
  return out;
}

export function freeTable(tables: number, bookings: Booking[], slot: Slot): number | null {
  const used = new Set(bookings.filter((r) => r.slotDate === slot.date && r.slotTime === slot.time).map((r) => r.table));
  for (let t = 1; t <= tables; t++) if (!used.has(t)) return t;
  return null;
}

export function matchScore(a: string[], b: string[]): number {
  const overlap = a.filter((s) => b.includes(s)).length;
  return Math.round((100 * overlap) / Math.max(1, Math.min(a.length, b.length)));
}

export function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

export function formatDate(d: string) {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day)).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}
