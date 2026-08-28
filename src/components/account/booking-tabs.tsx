"use client";

import { useState } from "react";
import { Ticket } from "lucide-react";
import { BUCKET_LABELS, type BookingBucket } from "@/lib/bookings";
import { BookingRow, type BookingSummary } from "./booking-row";
import { Card, CardBody } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const ORDER: BookingBucket[] = ["upcoming", "past", "cancelled"];

const EMPTY_COPY: Record<BookingBucket, { title: string; body: string }> = {
  upcoming: {
    title: "No upcoming trips",
    body: "Once you book a flight it will appear here, with your reference and ticket.",
  },
  past: {
    title: "No past trips yet",
    body: "Trips move here automatically once the departure date has passed.",
  },
  cancelled: {
    title: "Nothing cancelled",
    body: "Cancelled and refunded bookings are kept here for your records.",
  },
};

export function BookingTabs({
  buckets,
}: {
  buckets: Record<BookingBucket, BookingSummary[]>;
}) {
  const [active, setActive] = useState<BookingBucket>("upcoming");
  const shown = buckets[active];

  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" aria-label="Bookings" className="flex gap-1 border-b border-line">
        {ORDER.map((bucket) => (
          <button
            key={bucket}
            role="tab"
            type="button"
            aria-selected={active === bucket}
            onClick={() => setActive(bucket)}
            className={cn(
              "flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
              active === bucket
                ? "border-brand text-fg"
                : "border-transparent text-fg-muted hover:text-fg",
            )}
          >
            {BUCKET_LABELS[bucket]}
            <span className="text-xs text-fg-faint tabular">{buckets[bucket].length}</span>
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <Card>
          <CardBody className="flex flex-col items-start gap-3 py-10">
            <Ticket className="size-6 text-fg-faint" aria-hidden="true" />
            <h2 className="font-semibold">{EMPTY_COPY[active].title}</h2>
            <p className="max-w-md text-sm text-fg-muted">{EMPTY_COPY[active].body}</p>
          </CardBody>
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {shown.map((booking) => (
            <li key={booking.reference}>
              <BookingRow booking={booking} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
