"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { appUrl, sendEmail } from "@/lib/email";
import { slugify } from "@/lib/rules";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const int = (f: FormData, k: string, d: number) => {
  const n = parseInt(str(f, k), 10);
  return Number.isFinite(n) && n > 0 ? n : d;
};

function back(path: string, params: Record<string, string>): never {
  redirect(`${path}?${new URLSearchParams(params).toString()}`);
}

function eventFields(f: FormData) {
  return {
    name: str(f, "name"),
    city: str(f, "city"),
    state: str(f, "state"),
    stateCode: str(f, "stateCode").toUpperCase(),
    venue: str(f, "venue") || "Venue to be announced",
    startDate: str(f, "startDate"),
    days: Math.min(int(f, "days", 2), 7),
    dayStart: str(f, "dayStart") || "10:00",
    dayEnd: str(f, "dayEnd") || "17:00",
    slotMinutes: int(f, "slotMinutes", 30),
    tables: int(f, "tables", 10),
    sectors: str(f, "sectors")
      .split(/[,\n]/)
      .map((s) => s.trim())
      .filter(Boolean),
  };
}

function invalid(e: ReturnType<typeof eventFields>) {
  if (!e.name || !e.city || !e.state) return "Fill in the event name, city and state.";
  if (!/^[A-Z]{2}$/.test(e.stateCode)) return "The state code must be two letters, as in Udyam numbers (e.g. AP).";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(e.startDate)) return "Pick the first meeting day.";
  if (!/^\d{2}:\d{2}$/.test(e.dayStart) || !/^\d{2}:\d{2}$/.test(e.dayEnd) || e.dayStart >= e.dayEnd)
    return "Meetings must end after they start.";
  if (!e.sectors.length) return "Add at least one sector.";
  return null;
}

export async function createEvent(f: FormData) {
  await requireAdmin();
  const e = eventFields(f);
  const err = invalid(e);
  if (err) back("/admin", { error: err });
  let slug = slugify(e.name) || "event";
  if (await db.event.findUnique({ where: { slug } })) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
  const ev = await db.event.create({ data: { ...e, slug } });
  back(`/admin/events/${ev.id}`, { tab: "settings", notice: `${ev.name} created. Share ${appUrl(`/events/${slug}`)} with buyers and sellers.` });
}

export async function updateEvent(f: FormData) {
  await requireAdmin();
  const id = str(f, "id");
  const path = `/admin/events/${id}`;
  const e = eventFields(f);
  const err = invalid(e);
  if (err) back(path, { tab: "settings", error: err });
  await db.event.update({ where: { id }, data: { ...e, registrationOpen: f.get("registrationOpen") === "on" } });
  back(path, { tab: "settings", notice: "Event saved. Meetings already booked keep their slots." });
}

export async function reviewSeller(f: FormData) {
  await requireAdmin();
  const p = await db.participant.findUnique({ where: { id: str(f, "participantId") }, include: { event: true, user: true } });
  if (!p) redirect("/admin");
  const approve = str(f, "decision") === "approve";
  await db.participant.update({ where: { id: p.id }, data: { status: approve ? "APPROVED" : "REJECTED" } });
  const link = appUrl(`/events/${p.event.slug}`);
  await sendEmail(
    p.user.email,
    approve ? `You're approved for ${p.event.name}` : `Your registration for ${p.event.name}`,
    approve
      ? `Good news: ${p.company} is verified for ${p.event.name}.\n\nYou can now browse international buyers and book meetings: ${link}`
      : `Thank you for registering ${p.company} for ${p.event.name}. After reviewing the sector requirements, we're unable to include you in this event's matchmaking.\n\nFor questions, reply to this email or contact the organiser.`,
  );
  back(`/admin/events/${p.eventId}`, { tab: "approvals", notice: `${p.company} ${approve ? "approved" : "marked not eligible"}.` });
}
