import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { createHash, randomInt } from "crypto";
import { db } from "./db";

const COOKIE = "rbsm_session";
const SESSION_DAYS = 30;
const CODE_MINUTES = 10;
const MAX_ATTEMPTS = 5;
const MAX_CODES_PER_HOUR = 5;

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) throw new Error("SESSION_SECRET must be set to a long random string");
  return new TextEncoder().encode(s);
}

export function normaliseEmail(e: string) {
  return e.trim().toLowerCase();
}

export function isAdminEmail(email: string) {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map(normaliseEmail)
    .filter(Boolean)
    .includes(normaliseEmail(email));
}

export function adminEmails() {
  return (process.env.ADMIN_EMAILS || "").split(",").map(normaliseEmail).filter(Boolean);
}

function hashCode(email: string, code: string) {
  return createHash("sha256").update(`${process.env.SESSION_SECRET}:${email}:${code}`).digest("hex");
}

/** Creates a one-time code for the email. Returns null when too many codes were requested recently. */
export async function createLoginCode(email: string): Promise<string | null> {
  const since = new Date(Date.now() - 60 * 60 * 1000);
  const recent = await db.loginCode.count({ where: { email, createdAt: { gte: since } } });
  if (recent >= MAX_CODES_PER_HOUR) return null;
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await db.loginCode.create({
    data: { email, codeHash: hashCode(email, code), expiresAt: new Date(Date.now() + CODE_MINUTES * 60 * 1000) },
  });
  return code;
}

export async function verifyLoginCode(email: string, code: string): Promise<boolean> {
  const row = await db.loginCode.findFirst({
    where: { email, usedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!row || row.attempts >= MAX_ATTEMPTS) return false;
  if (row.codeHash !== hashCode(email, code.trim())) {
    await db.loginCode.update({ where: { id: row.id }, data: { attempts: { increment: 1 } } });
    return false;
  }
  await db.loginCode.update({ where: { id: row.id }, data: { usedAt: new Date() } });
  return true;
}

export async function startSession(email: string) {
  const user = await db.user.upsert({ where: { email }, update: {}, create: { email } });
  const token = await new SignJWT({ uid: user.id })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secret());
  cookies().set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export function endSession() {
  cookies().delete(COOKIE);
}

export type SessionUser = { id: string; email: string; isAdmin: boolean };

export async function currentUser(): Promise<SessionUser | null> {
  const token = cookies().get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    const user = await db.user.findUnique({ where: { id: String(payload.uid) } });
    if (!user) return null;
    return { id: user.id, email: user.email, isAdmin: isAdminEmail(user.email) };
  } catch {
    return null;
  }
}

export async function requireUser(next: string) {
  const u = await currentUser();
  if (!u) redirect(`/login?next=${encodeURIComponent(next)}`);
  return u;
}

export async function requireAdmin() {
  const u = await requireUser("/admin");
  if (!u.isAdmin) redirect("/");
  return u;
}
