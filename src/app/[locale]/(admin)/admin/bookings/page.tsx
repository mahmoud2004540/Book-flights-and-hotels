import { BookingStatus } from "@prisma/client";
import { setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requireCapability } from "@/lib/auth/admin-guard";
import { Link } from "@/i18n/navigation";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { STATUS_TONE } from "@/lib/bookings";
import { formatAmount, formatDate } from "@/lib/format";

const PAGE_SIZE = 25;

/** Anything else in the query string is ignored rather than trusted. */
function statusFilter(value: string | undefined): BookingStatus | null {
  const upper = value?.toUpperCase();
  return upper && upper in BookingStatus ? (upper as BookingStatus) : null;
}

export default async function AdminBookingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string; q?: string; page?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireCapability("bookings.read");

  const query = await searchParams;
  const status = statusFilter(query.status);
  const search = query.q?.trim() ?? "";
  const page = Math.max(1, Number(query.page) || 1);

  const where = {
    ...(status ? { status } : {}),
    ...(search
      ? {
          OR: [
            { reference: { contains: search, mode: "insensitive" as const } },
            { guestEmail: { contains: search, mode: "insensitive" as const } },
            { user: { email: { contains: search, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };

  const [bookings, count] = await Promise.all([
    prisma.booking.findMany({
      where,
      include: { user: { select: { email: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.booking.count({ where }),
  ]);

  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const href = (next: Record<string, string>) => {
    const search = new URLSearchParams({
      ...(status ? { status } : {}),
      ...(query.q ? { q: query.q } : {}),
      ...next,
    });
    return `/admin/bookings?${search.toString()}`;
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-2xl font-semibold">Bookings</h1>
        <span className="text-sm text-fg-muted tabular">{count} matching</span>
      </div>

      <form method="get" className="flex flex-wrap gap-2">
        <input
          type="search"
          name="q"
          defaultValue={search}
          placeholder="Reference or email"
          aria-label="Search bookings"
          className="min-w-56 flex-1 rounded-md border border-line bg-surface px-3 py-2 text-sm"
        />
        <select
          name="status"
          defaultValue={status ?? ""}
          aria-label="Filter by status"
          className="rounded-md border border-line bg-surface px-3 py-2 text-sm"
        >
          <option value="">Any status</option>
          {Object.values(BookingStatus).map((value) => (
            <option key={value} value={value}>
              {value.toLowerCase()}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-md border border-line px-4 py-2 text-sm font-medium hover:bg-surface-2"
        >
          Filter
        </button>
      </form>

      {bookings.length === 0 ? (
        <Card>
          <CardBody className="py-10 text-sm text-fg-muted">
            No booking matches that. Clear the filter to see everything.
          </CardBody>
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[52rem] text-sm">
            <thead className="border-b border-line text-fg-muted">
              <tr>
                <Th>Reference</Th>
                <Th>Who</Th>
                <Th>Status</Th>
                <Th>Supplier</Th>
                <Th align="end">Total</Th>
                <Th>Booked</Th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((booking) => (
                <tr key={booking.id} className="border-b border-line-soft last:border-0">
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/bookings/${booking.reference}`}
                      className="font-mono text-xs underline underline-offset-2"
                    >
                      {booking.reference}
                    </Link>
                  </td>
                  <td className="max-w-56 truncate px-4 py-2.5 text-fg-muted">
                    {booking.user?.email ?? booking.guestEmail ?? "guest"}
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge tone={STATUS_TONE[booking.status]}>
                      {booking.status.toLowerCase()}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5 text-fg-muted">{booking.supplierId}</td>
                  <td className="px-4 py-2.5 text-end tabular">
                    {formatAmount(booking.totalAmount.toString(), booking.currency)}
                  </td>
                  <td className="px-4 py-2.5 text-fg-muted">{formatDate(booking.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {pages > 1 && (
        <nav aria-label="Pages" className="flex items-center justify-between text-sm">
          {page > 1 ? (
            <Link href={href({ page: String(page - 1) })} className="underline underline-offset-2">
              Previous
            </Link>
          ) : (
            <span className="text-fg-faint">Previous</span>
          )}
          <span className="text-fg-muted tabular">
            Page {page} of {pages}
          </span>
          {page < pages ? (
            <Link href={href({ page: String(page + 1) })} className="underline underline-offset-2">
              Next
            </Link>
          ) : (
            <span className="text-fg-faint">Next</span>
          )}
        </nav>
      )}
    </div>
  );
}

function Th({ children, align }: { children: React.ReactNode; align?: "end" }) {
  return (
    <th
      scope="col"
      className={`px-4 py-2.5 font-medium ${align === "end" ? "text-end" : "text-start"}`}
    >
      {children}
    </th>
  );
}
