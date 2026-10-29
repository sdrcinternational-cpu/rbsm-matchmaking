import Link from "next/link";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { Chips } from "@/components/ui";
import { eventDates, formatDate } from "@/lib/rules";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await currentUser();
  const events = await db.event.findMany({ orderBy: { startDate: "asc" }, include: { _count: { select: { participants: true } } } });
  const mine = user ? await db.participant.findMany({ where: { userId: user.id }, select: { eventId: true } }) : [];
  const joined = new Set(mine.map((m) => m.eventId));
  return (
    <>
      <div className="panel">
        <h1>Meet international buyers in your state</h1>
        <p className="muted">
          Reverse Buyer–Seller Meets bring importers from around the world to Indian states. Register your company, browse
          the other side&apos;s profiles, and book face-to-face meetings in a few clicks.
        </p>
      </div>
      <h2>Events</h2>
      {events.length === 0 ? (
        <div className="empty">No events are open yet. Check back soon.</div>
      ) : (
        <div className="grid">
          {events.map((e) => (
            <article key={e.id} className="card">
              <h3>{e.name}</h3>
              <div className="meta">
                {e.venue}, {e.city}, {e.state}
              </div>
              <div className="meta">{eventDates(e).map(formatDate).join(" and ")}</div>
              <Chips items={e.sectors} />
              <div className="actions">
                <Link className="btn primary" href={`/events/${e.slug}`}>
                  {joined.has(e.id) ? "Open my dashboard" : e.registrationOpen ? "Register" : "View event"}
                </Link>
                {!e.registrationOpen && <span className="pill bad">Registration closed</span>}
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
