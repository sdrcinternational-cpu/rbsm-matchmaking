import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/auth";

const cell = (v: unknown) => {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await currentUser();
  if (!user?.isAdmin) return new NextResponse("Not allowed", { status: 403 });
  const event = await db.event.findUnique({ where: { id: params.id } });
  if (!event) return new NextResponse("Not found", { status: 404 });
  const rows = await db.meetingRequest.findMany({
    where: { eventId: event.id, status: "ACCEPTED" },
    include: { from: { include: { user: true } }, to: { include: { user: true } } },
    orderBy: [{ slotDate: "asc" }, { slotTime: "asc" }, { table: "asc" }],
  });
  const lines = [["Date", "Time", "Table", "Buyer", "Buyer contact", "Buyer email", "Seller", "Seller contact", "Seller email"].join(",")];
  for (const r of rows) {
    const buyer = r.from.role === "BUYER" ? r.from : r.to;
    const seller = r.from.role === "BUYER" ? r.to : r.from;
    lines.push(
      [r.slotDate, r.slotTime, r.table, buyer.company, buyer.contact, buyer.user.email, seller.company, seller.contact, seller.user.email]
        .map(cell)
        .join(","),
    );
  }
  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${event.slug}-meetings.csv"`,
    },
  });
}
