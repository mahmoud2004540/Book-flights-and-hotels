import { setRequestLocale } from "next-intl/server";
import { hotelSearchSchema } from "@/lib/validation/search";
import { HotelResults } from "@/components/hotels/results";
import { Card, CardBody } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";

function nights(checkIn: string, checkOut: string): number {
  const ms = new Date(`${checkOut}T00:00:00Z`).getTime() - new Date(`${checkIn}T00:00:00Z`).getTime();
  return Math.max(1, Math.round(ms / 86_400_000));
}

export default async function HotelsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const parsed = hotelSearchSchema.safeParse(await searchParams);

  if (!parsed.success) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <Card>
          <CardBody className="flex flex-col items-start gap-3 py-10">
            <h1 className="text-xl font-semibold">That search is missing something</h1>
            <p className="text-sm text-fg-muted">
              {parsed.error.issues[0]?.message ?? "Check the city and dates and try again."}
            </p>
            <Link href="/" className={buttonVariants({ variant: "outline" })}>
              Back to search
            </Link>
          </CardBody>
        </Card>
      </div>
    );
  }

  const query = parsed.data;
  const stay = nights(query.checkIn, query.checkOut);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <header className="mb-6 flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Hotels in {query.cityCode}</h1>
        <p className="text-sm text-fg-muted tabular">
          {query.checkIn} – {query.checkOut} · {stay} night{stay > 1 ? "s" : ""} ·{" "}
          {query.adults} guest{query.adults > 1 ? "s" : ""} · {query.rooms} room
          {query.rooms > 1 ? "s" : ""}
        </p>
      </header>

      <HotelResults
        query={{
          cityCode: query.cityCode,
          checkIn: query.checkIn,
          checkOut: query.checkOut,
          adults: query.adults,
          rooms: query.rooms,
          currency: query.currency,
        }}
      />
    </div>
  );
}
