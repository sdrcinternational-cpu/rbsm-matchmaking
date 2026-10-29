import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { appUrl } from "@/lib/email";
import { UDYAM_RE, IEC_RE, dayTimes, eventDates, formatDate } from "@/lib/rules";
import { Chips, EventHead, Flash, Tabs, statusPill } from "@/components/ui";
import { EventForm } from "@/components/EventForm";
import { reviewSeller, updateEvent } from "../../actions";

export const dynamic = "force-dynamic";

type SP = { tab?: string; notice?: string; error?: string };

export default async function AdminEvent({ params, searchParams }: { params: { id: string }; searchParams: SP }) {
  await requireAdmin();
  const event = await db.event.findUnique({ where: { id: params.id } });
  if (!event) notFound();
  const base = `/admin/events/${event.id}`;
  const people = await db.participant.findMany({ where: { eventId: event.id }, include: { user: true }, orderBy: { createdAt: "asc" } });
  const reqs = await db.meetingRequest.findMany({ where: { eventId: event.id }, include: { from: true, to: true } });
  const booked = reqs
    .filter((r) => r.status === "ACCEPTED")
    .sort((a, b) => `${a.slotDate}${a.slotTime}${String(a.table).padStart(3, "0")}`.localeCompare(`${b.slotDate}${b.slotTime}${String(b.table).padStart(3, "0")}`));
  const pending = people.filter((p) => p.status === "PENDING");
  const capacity = eventDates(event).length * dayTimes(event).length * event.tables;
  const meetingsOf = (id: string) => booked.filter((r) => r.fromId === id || r.toId === id).length;

  const tabs = [
    { key: "approvals", label: "Seller approvals", count: pending.length },
    { key: "meetings", label: "Meeting schedule" },
    { key: "participants", label: "Participants" },
    { key: "sectors", label: "By sector" },
    { key: "settings", label: "Event settings" },
  ];
  const tab = tabs.some((t) => t.key === searchParams.tab) ? searchParams.tab! : "approvals";

  return (
    <>
      <p className="small"><Link href="/admin">← All events</Link></p>
      <EventHead event={event} />
      <Flash notice={searchParams.notice} error={searchParams.error} />
      <div className="stats">
        <div className="stat"><span>International buyers</span><b>{people.filter((p) => p.role === "BUYER").length}</b></div>
        <div className="stat"><span>Verified sellers</span><b>{people.filter((p) => p.role === "SELLER" && p.status === "APPROVED").length}</b></div>
        <div className="stat"><span>Requests pending</span><b>{reqs.filter((r) => r.status === "PENDING").length}</b></div>
        <div className="stat"><span>Meetings booked</span><b>{booked.length}</b></div>
        <div className="stat"><span>Table slots used</span><b>{Math.round((100 * booked.length) / Math.max(1, capacity))}%</b></div>
      </div>
      <p className="small muted">Registration link to share: <span className="t">{appUrl(`/events/${event.slug}`)}</span></p>
      <Tabs base={base} current={tab} tabs={tabs} />

      {tab === "approvals" &&
        (pending.length === 0 ? (
          <div className="empty">No sellers waiting for approval. New seller registrations appear here with their Udyam and IEC numbers.</div>
        ) : (
          <div className="panel tablewrap">
            <table>
              <thead><tr><th>Seller</th><th>Udyam</th><th>IEC</th><th>Sectors and products</th><th></th></tr></thead>
              <tbody>
                {pending.map((p) => {
                  const m = UDYAM_RE.exec(p.udyam ?? "");
                  return (
                    <tr key={p.id}>
                      <td><b>{p.company}</b><div className="muted">{p.contact} · {p.place}</div><div className="muted small">{p.user.email}{p.phone ? ` · ${p.phone}` : ""}</div></td>
                      <td className="t">{p.udyam}<div className="muted">{m && m[1] === event.stateCode ? `${event.state} ✓` : "State mismatch"}</div></td>
                      <td className="t">{p.iec}<div className="muted">{IEC_RE.test(p.iec ?? "") ? "Format OK" : "Check format"}</div></td>
                      <td><Chips items={p.sectors} /><div className="small">{p.products}</div></td>
                      <td>
                        <form action={reviewSeller} className="actions">
                          <input type="hidden" name="participantId" value={p.id} />
                          <button className="btn primary" type="submit" name="decision" value="approve">Approve</button>
                          <button className="btn" type="submit" name="decision" value="reject">Reject</button>
                        </form>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}

      {tab === "meetings" && (
        <>
          <div className="row">
            <span className="muted">{booked.length} meetings booked</span>
            <a className="btn" href={`${base}/export`}>Download schedule (CSV)</a>
          </div>
          {booked.length === 0 ? (
            <div className="empty">No meetings booked yet. They appear here automatically when a buyer or seller accepts a request.</div>
          ) : (
            <div className="panel tablewrap">
              <table>
                <thead><tr><th>Date</th><th>Time</th><th>Table</th><th>Buyer</th><th>Seller</th></tr></thead>
                <tbody>
                  {booked.map((r) => {
                    const buyer = r.from.role === "BUYER" ? r.from : r.to;
                    const seller = r.from.role === "BUYER" ? r.to : r.from;
                    return (
                      <tr key={r.id}>
                        <td className="t">{formatDate(r.slotDate!)}</td>
                        <td className="t">{r.slotTime}</td>
                        <td className="t">{r.table}</td>
                        <td>{buyer.company}<div className="muted">{buyer.place}</div></td>
                        <td>{seller.company}<div className="muted">{seller.place}</div></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {tab === "participants" &&
        (people.length === 0 ? (
          <div className="empty">Nobody has registered yet.</div>
        ) : (
          <div className="panel tablewrap">
            <table>
              <thead><tr><th>Company</th><th>Side</th><th>From</th><th>Status</th><th>Sectors</th><th>Meetings</th></tr></thead>
              <tbody>
                {people.map((p) => (
                  <tr key={p.id}>
                    <td><b>{p.company}</b><div className="muted">{p.contact}</div><div className="muted small">{p.user.email}</div></td>
                    <td>{p.role === "BUYER" ? "Buyer" : "Seller"}</td>
                    <td>{p.place}</td>
                    <td>{statusPill[p.status]}</td>
                    <td><Chips items={p.sectors} /></td>
                    <td className="t">{meetingsOf(p.id)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

      {tab === "sectors" && (
        <div className="panel tablewrap">
          <table>
            <thead><tr><th>Sector</th><th>Buyers</th><th>Verified sellers</th><th>Meetings booked</th></tr></thead>
            <tbody>
              {event.sectors.map((s) => (
                <tr key={s}>
                  <td>{s}</td>
                  <td className="t">{people.filter((p) => p.role === "BUYER" && p.sectors.includes(s)).length}</td>
                  <td className="t">{people.filter((p) => p.role === "SELLER" && p.status === "APPROVED" && p.sectors.includes(s)).length}</td>
                  <td className="t">{booked.filter((r) => r.from.sectors.includes(s) && r.to.sectors.includes(s)).length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "settings" && (
        <div className="panel">
          <EventForm event={event} action={updateEvent} />
        </div>
      )}
    </>
  );
}
