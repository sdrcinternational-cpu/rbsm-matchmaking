import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { acceptedBookings } from "@/lib/booking";
import { eventDates, formatDate, freeSlots, matchScore } from "@/lib/rules";
import { Chips, EventHead, Flash, Tabs, statusPill } from "@/components/ui";
import { ProfileForm } from "@/components/ProfileForm";
import { cancelMeeting, register, respondRequest, sendRequest, updateProfile } from "../../actions";

export const dynamic = "force-dynamic";

type SP = { tab?: string; sector?: string; as?: string; notice?: string; error?: string };

export default async function EventPage({ params, searchParams }: { params: { slug: string }; searchParams: SP }) {
  const event = await db.event.findUnique({ where: { slug: params.slug } });
  if (!event) notFound();
  const base = `/events/${event.slug}`;
  const user = await currentUser();
  const me = user ? await db.participant.findUnique({ where: { eventId_userId: { eventId: event.id, userId: user.id } } }) : null;
  const flash = <Flash notice={searchParams.notice} error={searchParams.error} />;

  // ----- Not registered yet -----
  if (!me) {
    const role = searchParams.as === "SELLER" ? "SELLER" : searchParams.as === "BUYER" ? "BUYER" : null;
    return (
      <>
        <EventHead event={event} />
        {flash}
        {!event.registrationOpen ? (
          <div className="empty">Registration for this event is closed.</div>
        ) : !user ? (
          <div className="panel">
            <h2>Register for {event.name}</h2>
            <p className="muted">Sign in with your email to register as a foreign buyer or as a seller from {event.state}.</p>
            <div className="actions">
              <Link className="btn primary" href={`/login?next=${encodeURIComponent(base)}`}>Sign in to register</Link>
            </div>
          </div>
        ) : !role ? (
          <div className="grid">
            <article className="card">
              <h3>I&apos;m an international buyer</h3>
              <p className="muted">Importers and sourcing agents from outside India looking for suppliers in {event.state}.</p>
              <div className="actions"><Link className="btn primary" href={`${base}?as=BUYER`}>Register as buyer</Link></div>
            </article>
            <article className="card">
              <h3>I&apos;m a seller from {event.state}</h3>
              <p className="muted">MSMEs registered in {event.state}. You&apos;ll need your Udyam number and IEC code.</p>
              <div className="actions"><Link className="btn primary" href={`${base}?as=SELLER`}>Register as seller</Link></div>
            </article>
          </div>
        ) : (
          <div className="panel">
            <div className="row">
              <h2>Register as {role === "BUYER" ? "an international buyer" : `a seller from ${event.state}`}</h2>
              <Link className="btn link" href={base}>Change</Link>
            </div>
            <ProfileForm event={event} role={role} action={register} />
          </div>
        )}
      </>
    );
  }

  // ----- Registered participant -----
  const other = me.role === "BUYER" ? "SELLER" : "BUYER";
  const otherLabel = other === "BUYER" ? "buyers" : "sellers";
  const approved = me.status === "APPROVED";
  const requests = await db.meetingRequest.findMany({
    where: { OR: [{ fromId: me.id }, { toId: me.id }] },
    include: { from: true, to: true },
    orderBy: { createdAt: "desc" },
  });
  const incoming = requests.filter((r) => r.toId === me.id && r.status === "PENDING");
  const meetings = requests.filter((r) => r.status === "ACCEPTED");
  const tabs = approved
    ? [
        { key: "browse", label: `Browse ${otherLabel}` },
        { key: "requests", label: "Requests", count: incoming.length },
        { key: "schedule", label: "My schedule", count: meetings.length },
        { key: "profile", label: "My profile" },
      ]
    : [{ key: "profile", label: "My profile" }];
  const tab = tabs.some((t) => t.key === searchParams.tab) ? searchParams.tab! : tabs[0].key;

  let body: React.ReactNode = null;

  if (tab === "browse") {
    const sector = event.sectors.includes(searchParams.sector ?? "") ? searchParams.sector! : null;
    const people = await db.participant.findMany({
      where: { eventId: event.id, role: other, status: "APPROVED", ...(sector ? { sectors: { has: sector } } : {}) },
    });
    people.sort((a, b) => matchScore(me.sectors, b.sectors) - matchScore(me.sectors, a.sectors) || a.company.localeCompare(b.company));
    body = (
      <>
        <div className="chips" aria-label="Filter by sector">
          <Link className={`chip${!sector ? " on" : ""}`} href={`${base}?tab=browse`}>All sectors</Link>
          {event.sectors.map((s) => (
            <Link key={s} className={`chip${s === sector ? " on" : ""}`} href={`${base}?tab=browse&sector=${encodeURIComponent(s)}`}>{s}</Link>
          ))}
        </div>
        {people.length === 0 ? (
          <div className="empty">No {otherLabel} registered in this sector yet. New registrations appear here automatically.</div>
        ) : (
          <div className="grid">
            {people.map((p) => {
              const r = requests.find((q) => (q.fromId === p.id || q.toId === p.id) && q.status !== "CANCELLED");
              const hits = p.sectors.filter((s) => me.sectors.includes(s));
              return (
                <article key={p.id} className="card">
                  <div className="top">
                    <div className="who">
                      <h3>{p.company}</h3>
                      <div className="meta">{p.contact} · {p.place}</div>
                    </div>
                    <div className="score"><b>{matchScore(me.sectors, p.sectors)}%</b>match</div>
                  </div>
                  <Chips items={p.sectors} hits={hits} />
                  <p><b>{p.role === "BUYER" ? "Wants to buy" : "Sells"}:</b> {p.products}</p>
                  {p.about && <p className="muted">{p.about}</p>}
                  {p.extra && <p className="meta">{p.extra}</p>}
                  {p.role === "SELLER" && <p><span className="pill ok">Udyam + IEC verified</span></p>}
                  <div className="actions">
                    {!r || r.status === "DECLINED" ? (
                      r ? (
                        <span className="pill bad">Declined</span>
                      ) : (
                        <form action={sendRequest} className="form" style={{ width: "100%" }}>
                          <input type="hidden" name="slug" value={event.slug} />
                          <input type="hidden" name="toId" value={p.id} />
                          <label className="full">
                            Note (optional)
                            <input type="text" name="note" maxLength={500} placeholder="What would you like to discuss?" />
                          </label>
                          <div className="full"><button className="btn primary" type="submit">Request meeting</button></div>
                        </form>
                      )
                    ) : r.status === "ACCEPTED" ? (
                      <>
                        <span className="pill ok">Meeting booked</span>
                        <span className="slot">{formatDate(r.slotDate!)} · {r.slotTime} · Table {r.table}</span>
                      </>
                    ) : r.toId === me.id ? (
                      <>
                        <span className="pill pending">They requested you</span>
                        <Link className="btn" href={`${base}?tab=requests`}>Answer</Link>
                      </>
                    ) : (
                      <span className="pill pending">Request sent</span>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </>
    );
  }

  if (tab === "requests") {
    const outgoing = requests.filter((r) => r.fromId === me.id);
    const bookings = await acceptedBookings(event.id);
    body = (
      <>
        <h2>Waiting for your answer</h2>
        {incoming.length === 0 ? (
          <div className="empty">No new meeting requests. We&apos;ll email you when one arrives.</div>
        ) : (
          <div className="grid">
            {incoming.map((r) => {
              const slots = freeSlots(event, bookings, r.fromId, r.toId);
              return (
                <article key={r.id} className="card">
                  <div className="top">
                    <div className="who">
                      <h3>{r.from.company}</h3>
                      <div className="meta">{r.from.contact} · {r.from.place}</div>
                    </div>
                    <div className="score"><b>{matchScore(me.sectors, r.from.sectors)}%</b>match</div>
                  </div>
                  <p><b>{r.from.role === "BUYER" ? "Wants to buy" : "Sells"}:</b> {r.from.products}</p>
                  {r.note && <p>&ldquo;{r.note}&rdquo;</p>}
                  <form action={respondRequest} className="form">
                    <input type="hidden" name="slug" value={event.slug} />
                    <input type="hidden" name="requestId" value={r.id} />
                    {slots.length > 0 ? (
                      <label className="full">
                        Meeting slot
                        <select name="slot" defaultValue={`${slots[0].date}|${slots[0].time}`}>
                          {slots.map((s, i) => (
                            <option key={`${s.date}|${s.time}`} value={`${s.date}|${s.time}`}>
                              {formatDate(s.date)} · {s.time}{i === 0 ? " (earliest free)" : ""}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : (
                      <p className="full muted">No common free slot is left.</p>
                    )}
                    <div className="full actions">
                      {slots.length > 0 && <button className="btn primary" type="submit" name="decision" value="accept">Accept and book</button>}
                      <button className="btn" type="submit" name="decision" value="decline">Decline</button>
                    </div>
                  </form>
                </article>
              );
            })}
          </div>
        )}
        <h2>Sent by you</h2>
        {outgoing.length === 0 ? (
          <div className="empty">You haven&apos;t requested any meetings yet. <Link href={`${base}?tab=browse`}>Browse {otherLabel}</Link>.</div>
        ) : (
          <div className="panel tablewrap">
            <table>
              <thead><tr><th>Company</th><th>Status</th><th>Slot</th><th></th></tr></thead>
              <tbody>
                {outgoing.map((r) => (
                  <tr key={r.id}>
                    <td><b>{r.to.company}</b><div className="muted">{r.to.place}</div></td>
                    <td>
                      <span className={`pill ${r.status === "ACCEPTED" ? "ok" : r.status === "PENDING" ? "pending" : "bad"}`}>
                        {{ PENDING: "Waiting", ACCEPTED: "Booked", DECLINED: "Declined", CANCELLED: "Cancelled" }[r.status]}
                      </span>
                    </td>
                    <td className="t">{r.slotDate ? `${formatDate(r.slotDate)} · ${r.slotTime} · T${r.table}` : "–"}</td>
                    <td>
                      {r.status === "PENDING" && (
                        <form action={cancelMeeting}>
                          <input type="hidden" name="slug" value={event.slug} />
                          <input type="hidden" name="requestId" value={r.id} />
                          <button className="btn link" type="submit">Withdraw</button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </>
    );
  }

  if (tab === "schedule") {
    body =
      meetings.length === 0 ? (
        <div className="empty">Your confirmed meetings will appear here with time and table number.</div>
      ) : (
        <>
          {eventDates(event).map((d) => {
            const day = meetings.filter((r) => r.slotDate === d).sort((a, b) => a.slotTime!.localeCompare(b.slotTime!));
            return (
              <div key={d} className="sched-day">
                <h3>{formatDate(d)}</h3>
                {day.length === 0 ? (
                  <div className="muted">No meetings this day.</div>
                ) : (
                  day.map((r) => {
                    const o = r.fromId === me.id ? r.to : r.from;
                    return (
                      <div key={r.id} className="meeting">
                        <span className="t">{r.slotTime}</span>
                        <div>
                          <b>{o.company}</b>
                          <div className="muted">{o.contact} · {o.place}{o.phone ? ` · ${o.phone}` : ""}</div>
                        </div>
                        <div className="tbl">
                          Table {r.table}
                          <form action={cancelMeeting}>
                            <input type="hidden" name="slug" value={event.slug} />
                            <input type="hidden" name="requestId" value={r.id} />
                            <button className="btn link small" type="submit">Cancel</button>
                          </form>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            );
          })}
          <p className="muted small">All times are IST at {event.venue}, {event.city}.</p>
        </>
      );
  }

  if (tab === "profile") {
    body = (
      <>
        {me.status === "PENDING" && (
          <div className="panel">
            <div>{statusPill.PENDING}</div>
            <p>
              The organiser is checking your Udyam registration (<span className="t">{me.udyam}</span>) and IEC (
              <span className="t">{me.iec}</span>). We&apos;ll email you once you&apos;re approved, and you can then browse buyers and book meetings.
            </p>
          </div>
        )}
        {me.status === "REJECTED" && (
          <div className="panel">
            <div>{statusPill.REJECTED}</div>
            <p>Your registration was not selected for this event. Contact itd@indiasmeforum.org if you think this is a mistake.</p>
          </div>
        )}
        <div className="panel">
          <ProfileForm event={event} participant={me} action={updateProfile} />
        </div>
      </>
    );
  }

  return (
    <>
      <EventHead event={event} />
      {flash}
      <div className="panel row">
        <div>
          <h2>{me.company}</h2>
          <div className="muted">
            {me.role === "BUYER" ? "International buyer" : `Seller from ${event.state}`} · {me.contact} · {me.place}
          </div>
        </div>
        {me.role === "SELLER" && statusPill[me.status]}
      </div>
      <Tabs base={base} current={tab} tabs={tabs} />
      {body}
    </>
  );
}
