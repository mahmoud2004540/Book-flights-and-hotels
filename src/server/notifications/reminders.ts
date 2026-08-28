import { BookingStatus, NotifChannel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mail";
import { departureOf } from "@/server/booking/cancellation-rules";

/**
 * The 24-hour pre-travel reminder — section 4.6.
 *
 * Driven by a scheduler hitting the cron route rather than by BullMQ, which
 * needs the Redis instance that is not configured yet. The logic lives here so
 * moving it onto a queue later is a change of caller, not of behaviour.
 *
 * A notifications row is written before the email is sent and checked before
 * sending, so running the job twice in one window does not send twice — a
 * scheduler retry is normal and must not spam anyone.
 */

const REMINDER_TYPE = "trip_reminder_24h";

export type ReminderRun = { considered: number; sent: number; skipped: number };

type StoredSegment = { from: { code: string; at: string }; to: { code: string } };

function routeOf(details: unknown): string | null {
  const itineraries = (details as { itineraries?: Array<{ segments: StoredSegment[] }> } | null)
    ?.itineraries;
  const first = itineraries?.[0]?.segments?.[0];
  const last = itineraries?.[0]?.segments?.at(-1);
  return first && last ? `${first.from.code} to ${last.to.code}` : null;
}

export async function sendTripReminders(now = new Date()): Promise<ReminderRun> {
  const windowStart = new Date(now.getTime() + 23 * 3_600_000);
  const windowEnd = new Date(now.getTime() + 25 * 3_600_000);

  const bookings = await prisma.booking.findMany({
    where: { status: BookingStatus.CONFIRMED },
    include: { items: { where: { itemType: "flight_offer" } } },
  });

  let sent = 0;
  let skipped = 0;
  let considered = 0;

  for (const booking of bookings) {
    const details = booking.items[0]?.details;
    const departureAt = departureOf(details);
    // The window is two hours wide so an hourly scheduler cannot miss a
    // departure by landing between ticks.
    if (!departureAt || departureAt < windowStart || departureAt > windowEnd) continue;

    considered++;

    const already = await prisma.notification.findFirst({
      where: { type: REMINDER_TYPE, payload: { path: ["reference"], equals: booking.reference } },
    });
    if (already) {
      skipped++;
      continue;
    }

    const to = booking.guestEmail ?? (await emailFor(booking.userId));
    if (!to) {
      skipped++;
      continue;
    }

    const route = routeOf(details) ?? "your trip";
    // Written before sending, and for guests too, so a scheduler retry finds
    // it and does not send a second time.
    const notification = await prisma.notification.create({
      data: {
        userId: booking.userId,
        type: REMINDER_TYPE,
        channel: NotifChannel.EMAIL,
        payload: { reference: booking.reference, route },
      },
    });

    const result = await sendMail(to, {
      kind: "tripReminder",
      reference: booking.reference,
      departsAt: departureAt.toISOString().slice(0, 16).replace("T", " "),
      route,
    });

    if (result.ok) {
      sent++;
      await prisma.notification.update({
        where: { id: notification.id },
        data: { sentAt: new Date() },
      });
    } else {
      skipped++;
      // The row stays with sentAt null: a failed send is visible for support,
      // and the next run still will not re-send blindly.
      console.error(`Reminder failed for ${booking.reference}: ${result.error}`);
    }
  }

  return { considered, sent, skipped };
}

async function emailFor(userId: string | null): Promise<string | null> {
  if (!userId) return null;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  return user?.email ?? null;
}
