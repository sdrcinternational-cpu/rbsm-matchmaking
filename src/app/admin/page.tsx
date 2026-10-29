import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { Chips, Flash } from "@/components/ui";
import { EventForm } from "@/components/EventForm";
import { eventDates, formatDate } from "@/lib/rules";
import { createEvent } from "./actions";

export const dynamic = "force-dynamic";

export default async function Admin({ searchParams }: { searchParams: { notice?: string; error?: string } }) {
  await requireAdmin();
  const events = await db.event.findMany({ orderBy: { startDate: "asc" } });
  const pending = await db.participant.groupBy({ by: ["eventId"], where: { status: "PENDING" }, _count: true });
  const pendingFor = (id: string) => pending.find((p) => p.eventId === id)?._count ?? 0;
  return (
    <>
      <h1>Organiser</h1>
      <Flash {...searchParams} />
      {events.length > 0 && (
        <div className="grid">
          {events.map((e) => (
            <article key={e.id} className="card">
              <h3>{e.name}</h3>
              <div className="meta">{e.city}, {e.state} · {eventDates(e).map(formatDate).join(", ")}</div>
              <Chips items={e.sectors} />
              <div className="actions">
                <Link className="btn primary" href={`/admin/events/${e.id}`}>Manage</Link>
                {pendingFor(e.id) > 0 && <span className="pill pending">{pendingFor(e.id)} to approve</span>}
                {!e.registrationOpen && <span className="pill bad">Registration closed</span>}
              </div>
            </article>
          ))}
        </div>
      )}
      <div className="panel">
        <h2>Create an event</h2>
        <EventForm action={createEvent} />
      </div>
    </>
  );
}
