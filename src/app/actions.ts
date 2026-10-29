"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import {
  adminEmails,
  createLoginCode,
  endSession,
  normaliseEmail,
  requireUser,
  startSession,
  verifyLoginCode,
} from "@/lib/auth";
import { appUrl, sendEmail } from "@/lib/email";
import { bookRequest } from "@/lib/booking";
import { checkSellerIds, formatDate, normaliseIec, normaliseUdyam } from "@/lib/rules";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const safeNext = (n: string) => (n.startsWith("/") && !n.startsWith("//") ? n : "/");

function back(path: string, params: Record<string, string>): never {
  const q = new URLSearchParams(params).toString();
  redirect(`${path}${path.includes("?") ? "&" : "?"}${q}`);
}

// ---------- Sign in ----------

export async function requestCode(f: FormData) {
  const email = normaliseEmail(str(f, "email"));
  const next = safeNext(str(f, "next"));
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) back("/login", { next, error: "Enter a valid email address." });
  const code = await createLoginCode(email);
  if (!code) back("/login", { next, error: "Too many codes requested. Please wait an hour and try again." });
  await sendEmail(
    email,
    `${code} is your RBSM Connect sign-in code`,
    `Your sign-in code is ${code}. It expires in 10 minutes.\n\nIf you didn't request it, you can ignore this email.`,
  );
  back("/login", { step: "code", email, next });
}

export async function verifyCode(f: FormData) {
  const email = normaliseEmail(str(f, "email"));
  const next = safeNext(str(f, "next"));
  if (!(await verifyLoginCode(email, str(f, "code"))))
    back("/login", { step: "code", email, next, error: "That code is wrong or has expired. Check the latest email or request a new code." });
  await startSession(email);
  redirect(next);
}

export async function signOut() {
  endSession();
  redirect("/");
}

// ---------- Registration and profile ----------

function profileFields(f: FormData, allowed: string[]) {
  const sectors = f.getAll("sectors").map(String).filter((s) => allowed.includes(s));
  return {
    company: str(f, "company"),
    contact: str(f, "contact"),
    phone: str(f, "phone"),
    place: str(f, "place"),
    products: str(f, "products"),
    about: str(f, "about"),
    extra: str(f, "extra"),
    sectors,
  };
}

function missing(p: ReturnType<typeof profileFields>) {
  if (!p.company || !p.contact || !p.place || !p.products) return "Fill in company, contact person, location and products.";
  if (!p.sectors.length) return "Pick at least one sector.";
  return null;
}

export async function register(f: FormData) {
  const slug = str(f, "slug");
  const path = `/events/${slug}`;
  const user = await requireUser(path);
  const event = await db.event.findUnique({ where: { slug } });
  if (!event) redirect("/");
  if (!event.registrationOpen) back(path, { error: "Registration for this event is closed." });
  const role = str(f, "role") === "SELLER" ? "SELLER" : "BUYER";
  const p = profileFields(f, event.sectors);
  const err = missing(p);
  if (err) back(path, { error: err });
  let udyam: string | null = null;
  let iec: string | null = null;
  if (role === "SELLER") {
    udyam = normaliseUdyam(str(f, "udyam"));
    iec = normaliseIec(str(f, "iec"));
    const idErr = checkSellerIds(udyam, iec, event.stateCode, event.state);
    if (idErr) back(path, { error: idErr });
  }
  const existing = await db.participant.findUnique({ where: { eventId_userId: { eventId: event.id, userId: user.id } } });
  if (existing) redirect(path);
  await db.participant.create({
    data: {
      ...p,
      eventId: event.id,
      userId: user.id,
      role,
      status: role === "SELLER" ? "PENDING" : "APPROVED",
      udyam,
      iec,
    },
  });
  if (role === "SELLER") {
    await sendEmail(
      adminEmails(),
      `New seller to verify: ${p.company}`,
      `${p.company} registered for ${event.name}.\nUdyam: ${udyam}\nIEC: ${iec}\nSectors: ${p.sectors.join(", ")}\n\nReview: ${appUrl(`/admin/events/${event.id}?tab=approvals`)}`,
    );
    back(path, { tab: "profile", notice: "Thanks for registering. The organiser will verify your Udyam and IEC, and we'll email you once you're approved." });
  }
  back(path, { tab: "browse", notice: `Welcome to ${event.name}. You can now browse sellers and request meetings.` });
}

export async function updateProfile(f: FormData) {
  const slug = str(f, "slug");
  const path = `/events/${slug}`;
  const user = await requireUser(path);
  const me = await db.participant.findFirst({ where: { userId: user.id, event: { slug } }, include: { event: true } });
  if (!me) redirect(path);
  const p = profileFields(f, me.event.sectors);
  const err = missing(p);
  if (err) back(path, { tab: "profile", error: err });
  let reverify = false;
  const data: Record<string, unknown> = { ...p };
  if (me.role === "SELLER") {
    const udyam = normaliseUdyam(str(f, "udyam"));
    const iec = normaliseIec(str(f, "iec"));
    const idErr = checkSellerIds(udyam, iec, me.event.stateCode, me.event.state);
    if (idErr) back(path, { tab: "profile", error: idErr });
    if (udyam !== me.udyam || iec !== me.iec) {
      reverify = true;
      Object.assign(data, { udyam, iec, status: "PENDING" });
    }
  }
  await db.participant.update({ where: { id: me.id }, data });
  back(path, {
    tab: "profile",
    notice: reverify ? "Saved. Your new Udyam or IEC number will be verified again before you can meet buyers." : "Profile saved.",
  });
}

// ---------- Meetings ----------

async function meIn(slug: string, path: string) {
  const user = await requireUser(path);
  const me = await db.participant.findFirst({ where: { userId: user.id, event: { slug } }, include: { event: true, user: true } });
  if (!me) redirect(path);
  return me;
}

export async function sendRequest(f: FormData) {
  const slug = str(f, "slug");
  const path = `/events/${slug}`;
  const me = await meIn(slug, path);
  const other = await db.participant.findUnique({ where: { id: str(f, "toId") }, include: { user: true } });
  if (me.status !== "APPROVED") back(path, { error: "Your registration needs to be approved first." });
  if (!other || other.eventId !== me.eventId || other.role === me.role || other.status !== "APPROVED")
    back(path, { tab: "browse", error: "That company isn't available for meetings." });
  const existing = await db.meetingRequest.findFirst({
    where: { OR: [{ fromId: me.id, toId: other.id }, { fromId: other.id, toId: me.id }] },
  });
  if (existing && existing.status !== "CANCELLED")
    back(path, { tab: "browse", error: `You already have a request with ${other.company}.` });
  if (existing) await db.meetingRequest.delete({ where: { id: existing.id } });
  await db.meetingRequest.create({
    data: { eventId: me.eventId, fromId: me.id, toId: other.id, note: str(f, "note").slice(0, 500) },
  });
  await sendEmail(
    other.user.email,
    `${me.company} wants to meet you at ${me.event.name}`,
    `${me.company} (${me.place}) has requested a meeting with you.${str(f, "note") ? `\n\nTheir note: "${str(f, "note")}"` : ""}\n\nAccept and pick a time: ${appUrl(`${path}?tab=requests`)}`,
  );
  back(path, { tab: "browse", notice: `Request sent to ${other.company}.` });
}

export async function respondRequest(f: FormData) {
  const slug = str(f, "slug");
  const path = `/events/${slug}`;
  const me = await meIn(slug, path);
  const req = await db.meetingRequest.findUnique({ where: { id: str(f, "requestId") }, include: { from: { include: { user: true } } } });
  if (!req || req.toId !== me.id || req.status !== "PENDING") back(path, { tab: "requests", error: "This request is no longer open." });
  if (str(f, "decision") === "decline") {
    await db.meetingRequest.update({ where: { id: req.id }, data: { status: "DECLINED" } });
    await sendEmail(req.from.user.email, `Meeting request to ${me.company}`, `${me.company} couldn't take a meeting with you at ${me.event.name}. You can request meetings with other companies at ${appUrl(path)}.`);
    back(path, { tab: "requests", notice: "Request declined." });
  }
  if (me.status !== "APPROVED") back(path, { tab: "requests", error: "Your registration needs to be approved first." });
  const [date, time] = str(f, "slot").split("|");
  const result = await bookRequest(req.id, { date, time });
  if (!result.ok) back(path, { tab: "requests", error: result.error });
  const when = `${formatDate(date)} at ${time} IST, table ${result.table}`;
  const venue = `${me.event.venue}, ${me.event.city}`;
  await sendEmail(
    [req.from.user.email, me.user.email],
    `Meeting booked: ${req.from.company} and ${me.company}`,
    `Your meeting at ${me.event.name} is confirmed.\n\n${req.from.company} and ${me.company}\n${when}\n${venue}\n\nSee your schedule: ${appUrl(`${path}?tab=schedule`)}`,
  );
  back(path, { tab: "schedule", notice: `Meeting booked: ${when}.` });
}

export async function cancelMeeting(f: FormData) {
  const slug = str(f, "slug");
  const path = `/events/${slug}`;
  const me = await meIn(slug, path);
  const req = await db.meetingRequest.findUnique({
    where: { id: str(f, "requestId") },
    include: { from: { include: { user: true } }, to: { include: { user: true } } },
  });
  if (!req || (req.fromId !== me.id && req.toId !== me.id) || (req.status !== "ACCEPTED" && req.status !== "PENDING"))
    back(path, { tab: "schedule", error: "This meeting can't be cancelled." });
  await db.meetingRequest.update({
    where: { id: req.id },
    data: { status: "CANCELLED", slotDate: null, slotTime: null, table: null },
  });
  const other = req.fromId === me.id ? req.to : req.from;
  await sendEmail(other.user.email, `${me.company} cancelled your meeting`, `${me.company} cancelled the meeting at ${me.event.name}. The slot is free again in your schedule.`);
  back(path, { tab: req.status === "ACCEPTED" ? "schedule" : "requests", notice: "Cancelled." });
}
