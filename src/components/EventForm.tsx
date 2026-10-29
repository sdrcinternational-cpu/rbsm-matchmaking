import type { Event } from "@prisma/client";

export function EventForm({ event, action }: { event?: Event; action: (f: FormData) => Promise<void> }) {
  const e = event;
  return (
    <form action={action} className="form">
      {e && <input type="hidden" name="id" value={e.id} />}
      <label>Event name<input type="text" name="name" required defaultValue={e?.name} placeholder="Tirupati RBSM 2026" /></label>
      <label>City<input type="text" name="city" required defaultValue={e?.city} placeholder="Tirupati" /></label>
      <label>State<input type="text" name="state" required defaultValue={e?.state} placeholder="Andhra Pradesh" /></label>
      <label>State code in Udyam numbers<input type="text" name="stateCode" required maxLength={2} defaultValue={e?.stateCode} placeholder="AP" /></label>
      <label className="full">Venue<input type="text" name="venue" defaultValue={e?.venue} placeholder="Venue to be announced" /></label>
      <label>First meeting day<input type="date" name="startDate" required defaultValue={e?.startDate} /></label>
      <label>Number of days<input type="number" name="days" min={1} max={7} defaultValue={e?.days ?? 2} /></label>
      <label>Meetings start (IST)<input type="time" name="dayStart" defaultValue={e?.dayStart ?? "10:00"} /></label>
      <label>Meetings end (IST)<input type="time" name="dayEnd" defaultValue={e?.dayEnd ?? "17:00"} /></label>
      <label>Meeting length (minutes)<input type="number" name="slotMinutes" min={10} step={5} defaultValue={e?.slotMinutes ?? 30} /></label>
      <label>Meeting tables<input type="number" name="tables" min={1} defaultValue={e?.tables ?? 15} /></label>
      <label className="full">
        Sectors, one per line or comma separated
        <textarea name="sectors" rows={4} required defaultValue={e?.sectors.join("\n")} placeholder={"Textiles\nPharmaceuticals & Medical Equipment"} />
      </label>
      {e && (
        <div className="full checks">
          <label><input type="checkbox" name="registrationOpen" defaultChecked={e.registrationOpen} /> Registration open</label>
        </div>
      )}
      {e && <p className="full muted small">Changing timings doesn&apos;t move meetings that are already booked.</p>}
      <div className="full actions"><button className="btn primary" type="submit">{e ? "Save event" : "Create event"}</button></div>
    </form>
  );
}
