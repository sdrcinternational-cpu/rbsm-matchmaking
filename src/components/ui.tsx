import Link from "next/link";
import type { Event } from "@prisma/client";
import { eventDates, formatDate } from "@/lib/rules";

export function Flash({ notice, error }: { notice?: string; error?: string }) {
  return (
    <>
      {notice && <div className="flash notice" role="status">{notice}</div>}
      {error && <div className="flash error" role="alert">{error}</div>}
    </>
  );
}

export function Chips({ items, hits = [] }: { items: string[]; hits?: string[] }) {
  return (
    <div className="chips">
      {items.map((s) => (
        <span key={s} className={`chip${hits.includes(s) ? " hit" : ""}`}>{s}</span>
      ))}
    </div>
  );
}

export function Tabs({ base, current, tabs }: { base: string; current: string; tabs: { key: string; label: string; count?: number }[] }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <Link key={t.key} href={`${base}?tab=${t.key}`} aria-current={t.key === current ? "page" : undefined}>
          {t.label}
          {t.count ? <span className="count">{t.count}</span> : null}
        </Link>
      ))}
    </div>
  );
}

export function EventHead({ event }: { event: Event }) {
  return (
    <div className="eventhead">
      <div>
        <h1>{event.name}</h1>
        <p>
          {event.venue}, {event.city} · {eventDates(event).map(formatDate).join(" and ")} · {event.slotMinutes}-minute meetings
        </p>
      </div>
      <Chips items={event.sectors} />
    </div>
  );
}

export const statusPill = {
  PENDING: <span className="pill pending">Awaiting verification</span>,
  APPROVED: <span className="pill ok">Verified</span>,
  REJECTED: <span className="pill bad">Not eligible</span>,
};
