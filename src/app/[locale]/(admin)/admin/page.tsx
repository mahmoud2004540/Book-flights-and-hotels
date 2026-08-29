import { setRequestLocale } from "next-intl/server";
import { requireCapability } from "@/lib/auth/admin-guard";
import { can } from "@/lib/admin/permissions";
import { byStatus, bySupplier, daily, revenue, totals } from "@/server/admin/stats";
import { Stat } from "@/components/admin/stat";
import { BookingsChart } from "@/components/admin/bookings-chart";
import { Card, CardBody } from "@/components/ui/card";
import { formatAmount } from "@/lib/format";

const WINDOW_DAYS = 30;

export default async function AdminOverviewPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const staff = await requireCapability("bookings.read");
  const showRevenue = can(staff.role, "revenue.read");

  // Revenue is fetched only for a role allowed to see it, so the figure is not
  // computed and then hidden in the markup.
  const [counts, points, statuses, suppliers, money] = await Promise.all([
    totals(WINDOW_DAYS),
    daily(WINDOW_DAYS),
    byStatus(WINDOW_DAYS),
    bySupplier(WINDOW_DAYS),
    showRevenue ? revenue(WINDOW_DAYS) : Promise.resolve(null),
  ]);

  const conversion =
    counts.bookings > 0 ? Math.round((counts.confirmed / counts.bookings) * 100) : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Overview</h1>
        <p className="mt-1 text-sm text-fg-muted">The last {WINDOW_DAYS} days.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Bookings"
          value={counts.bookings}
          detail={conversion === null ? "No bookings yet" : `${conversion}% reached confirmed`}
        />
        <Stat label="Confirmed" value={counts.confirmed} />
        <Stat
          label="Cancelled"
          value={counts.cancelled}
          detail={counts.failed > 0 ? `${counts.failed} failed outright` : undefined}
        />
        <Stat label="Travellers" value={counts.users} detail={`${counts.newUsers} new`} />
      </div>

      {showRevenue && (
        <div className="grid gap-3 sm:grid-cols-3">
          {money ? (
            <>
              <Stat label="Taken" value={formatAmount(money.gross, money.currency)} />
              <Stat label="Refunded" value={formatAmount(money.refunded, money.currency)} />
              <Stat
                label="Net"
                value={formatAmount(money.net, money.currency)}
                detail="Succeeded payments, less refunds"
              />
            </>
          ) : (
            <Card className="sm:col-span-3">
              <CardBody className="py-5 text-sm text-fg-muted">
                {/* Adding EGP to USD and calling the sum revenue would be worse
                    than showing nothing, so a mixed window says so. */}
                No single-currency total for this window — payments came in more
                than one currency, or none did.
              </CardBody>
            </Card>
          )}
        </div>
      )}

      <Card>
        <CardBody>
          <BookingsChart points={points} />
        </CardBody>
      </Card>

      <div className="grid gap-3 md:grid-cols-2">
        <Breakdown
          title="By status"
          rows={statuses.map((row) => ({ label: row.status.toLowerCase(), value: row.count }))}
          empty="Nothing booked in this window."
        />
        <Breakdown
          title="By supplier"
          rows={suppliers.map((row) => ({ label: row.supplierId, value: row.bookings }))}
          empty="No supplier has taken a booking yet."
        />
      </div>
    </div>
  );
}

function Breakdown({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: Array<{ label: string; value: number }>;
  empty: string;
}) {
  const total = rows.reduce((sum, row) => sum + row.value, 0);

  return (
    <Card>
      <CardBody className="flex flex-col gap-3">
        <h2 className="font-semibold">{title}</h2>
        {rows.length === 0 ? (
          <p className="text-sm text-fg-muted">{empty}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {rows.map((row) => (
              <li key={row.label} className="flex items-center gap-3 text-sm">
                <span className="w-24 shrink-0 truncate text-fg-muted">{row.label}</span>
                <span
                  aria-hidden="true"
                  className="h-1.5 rounded-full bg-chart-1"
                  style={{ width: `${total > 0 ? Math.max((row.value / total) * 100, 2) : 0}%` }}
                />
                <span className="ms-auto tabular">{row.value}</span>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
