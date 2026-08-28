import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { sendTripReminders } from "@/server/notifications/reminders";

/**
 * Sends pre-travel reminders. Meant to be called hourly by a scheduler —
 * Vercel Cron, or anything that can hit a URL with a header.
 *
 * Protected by a shared secret, because an open endpoint that sends email is
 * an open spam relay. Compared in constant time so the comparison itself
 * cannot be used to guess the secret a character at a time.
 */
function authorised(request: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;

  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: Request): Promise<NextResponse> {
  if (!authorised(request)) {
    return NextResponse.json({ ok: false, reason: "unauthorised" }, { status: 401 });
  }

  try {
    const run = await sendTripReminders();
    return NextResponse.json({ ok: true, ...run });
  } catch (error) {
    console.error("Reminder run failed:", error);
    return NextResponse.json({ ok: false, reason: "run_failed" }, { status: 500 });
  }
}
