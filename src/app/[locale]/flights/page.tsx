import { setRequestLocale } from "next-intl/server";
import { flightSearchSchema } from "@/lib/validation/search";
import { FlightResults } from "@/components/flights/results";
import { Card, CardBody } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";

export default async function FlightsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const raw = await searchParams;
  const parsed = flightSearchSchema.safeParse(raw);

  // An invalid or absent query is a normal arrival on this URL, not an error
  // worth a stack trace — send them back to the search box.
  if (!parsed.success) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <Card>
          <CardBody className="flex flex-col items-start gap-3 py-10">
            <h1 className="text-xl font-semibold">That search is missing something</h1>
            <p className="text-sm text-fg-muted">
              {parsed.error.issues[0]?.message ?? "Check the route and dates and try again."}
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

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <header className="mb-6 flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">
          {query.origin} <span className="text-fg-faint">→</span> {query.destination}
        </h1>
        <p className="text-sm text-fg-muted tabular">
          {query.departDate}
          {query.returnDate && ` – ${query.returnDate}`} · {query.adults} passenger
          {query.adults > 1 ? "s" : ""} · {query.cabin.toLowerCase().replace("_", " ")}
        </p>
      </header>

      <FlightResults
        search={query}
        query={{
          origin: query.origin,
          destination: query.destination,
          departDate: query.departDate,
          returnDate: query.returnDate,
          adults: query.adults,
          cabin: query.cabin,
          currency: query.currency,
        }}
      />
    </div>
  );
}
