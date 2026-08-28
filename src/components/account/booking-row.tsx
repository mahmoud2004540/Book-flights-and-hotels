import { ArrowRight, Plane } from "lucide-react";
import type { BookingStatus } from "@prisma/client";
import { Link } from "@/i18n/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { STATUS_TONE } from "@/lib/bookings";
import { formatAmount, formatDate } from "@/lib/format";

export type BookingSummary = {
  reference: string;
  status: BookingStatus;
  route: string | null;
  departureAt: Date | null;
  total: string;
  currency: string;
  createdAt: Date;
};

export function BookingRow({ booking }: { booking: BookingSummary }) {
  return (
    <Card className="transition-shadow hover:shadow-md">
      <Link
        href={`/bookings/${booking.reference}`}
        className="flex flex-wrap items-center justify-between gap-4 p-4"
      >
        <div className="flex min-w-0 items-center gap-3">
          <Plane className="size-4 shrink-0 text-fg-faint" aria-hidden="true" />
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 font-medium">
              {booking.route ?? "Booking"}
              <Badge tone={STATUS_TONE[booking.status]}>
                {booking.status.toLowerCase()}
              </Badge>
            </p>
            <p className="mt-0.5 text-xs text-fg-muted tabular">
              <span className="font-mono">{booking.reference}</span>
              {booking.departureAt && ` · departs ${formatDate(booking.departureAt)}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-sm font-semibold tabular">
            {formatAmount(booking.total, booking.currency)}
          </span>
          <ArrowRight className="size-4 text-fg-faint" aria-hidden="true" />
        </div>
      </Link>
    </Card>
  );
}
