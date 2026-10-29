import type { Event, Participant } from "@prisma/client";

/** Registration (no participant yet) or profile edit form. Seller-only fields show for sellers. */
export function ProfileForm({
  event,
  participant,
  action,
  role,
}: {
  event: Event;
  participant?: Participant;
  action: (f: FormData) => Promise<void>;
  role?: "BUYER" | "SELLER";
}) {
  const p = participant;
  const isSeller = (p?.role ?? role) === "SELLER";
  return (
    <form action={action} className="form">
      <input type="hidden" name="slug" value={event.slug} />
      {!p && <input type="hidden" name="role" value={role} />}
      <label>
        Company name
        <input type="text" name="company" required defaultValue={p?.company} />
      </label>
      <label>
        Contact person
        <input type="text" name="contact" required defaultValue={p?.contact} />
      </label>
      <label>
        Phone / WhatsApp
        <input type="tel" name="phone" defaultValue={p?.phone} />
      </label>
      <label>
        {isSeller ? "City, state" : "City, country"}
        <input type="text" name="place" required defaultValue={p?.place} placeholder={isSeller ? `e.g. Tirupati, ${event.state}` : "e.g. Dubai, UAE"} />
      </label>
      {isSeller && (
        <>
          <label>
            Udyam registration number
            <input type="text" name="udyam" required defaultValue={p?.udyam ?? ""} placeholder={`UDYAM-${event.stateCode}-00-0000000`} />
          </label>
          <label>
            IEC code
            <input type="text" name="iec" required maxLength={10} defaultValue={p?.iec ?? ""} placeholder="10-character Import Export Code" />
          </label>
          <p className="full muted small">
            Both are mandatory for matchmaking. The Udyam number must be registered in {event.state}. The organiser verifies
            them before you can meet buyers{p ? ", and changing them sends your profile for verification again" : ""}.
          </p>
        </>
      )}
      <div className="full">
        <label>Sectors</label>
        <div className="checks">
          {event.sectors.map((s) => (
            <label key={s}>
              <input type="checkbox" name="sectors" value={s} defaultChecked={p?.sectors.includes(s)} />
              {s}
            </label>
          ))}
        </div>
      </div>
      <label className="full">
        {isSeller ? "Products you sell" : "Products you want to buy"}
        <input type="text" name="products" required defaultValue={p?.products} />
      </label>
      <label className="full">
        About the company
        <textarea name="about" rows={3} defaultValue={p?.about} />
      </label>
      <label className="full">
        {isSeller ? "Certifications and export markets" : "Annual import volume and requirements"}
        <input type="text" name="extra" defaultValue={p?.extra} />
      </label>
      <div className="full actions">
        <button className="btn primary" type="submit">{p ? "Save profile" : "Register for this event"}</button>
      </div>
    </form>
  );
}
