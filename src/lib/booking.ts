import { Prisma } from "@prisma/client";
import { db } from "./db";
import { freeSlots, freeTable, type Booking, type Slot } from "./rules";

export async function acceptedBookings(eventId: string, tx: Prisma.TransactionClient = db): Promise<Booking[]> {
  const rows = await tx.meetingRequest.findMany({
    where: { eventId, status: "ACCEPTED" },
    select: { fromId: true, toId: true, slotDate: true, slotTime: true, table: true },
  });
  return rows.filter((r) => r.slotDate && r.slotTime && r.table) as Booking[];
}

/**
 * Books the requested slot for a pending request inside a serializable transaction, so two people
 * accepting at the same moment can never get the same table or a double-booked participant.
 * Returns the booked slot, or an error message.
 */
export async function bookRequest(
  requestId: string,
  slot: Slot,
): Promise<{ ok: true; table: number } | { ok: false; error: string }> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await db.$transaction(
        async (tx) => {
          const req = await tx.meetingRequest.findUnique({ where: { id: requestId }, include: { event: true } });
          if (!req || req.status !== "PENDING") return { ok: false as const, error: "This request is no longer open." };
          const bookings = await acceptedBookings(req.eventId, tx);
          const open = freeSlots(req.event, bookings, req.fromId, req.toId);
          if (!open.some((s) => s.date === slot.date && s.time === slot.time))
            return { ok: false as const, error: "That slot was just taken. Please pick another." };
          const table = freeTable(req.event.tables, bookings, slot);
          if (!table) return { ok: false as const, error: "No table is free at that time. Please pick another slot." };
          await tx.meetingRequest.update({
            where: { id: req.id },
            data: { status: "ACCEPTED", slotDate: slot.date, slotTime: slot.time, table },
          });
          return { ok: true as const, table };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code === "P2034" || code === "P2002") continue; // write conflict: retry with fresh data
      throw e;
    }
  }
  return { ok: false, error: "Several people are booking at once. Please try again." };
}
