"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, SearchX } from "lucide-react";
import type { PublicFlightOffer } from "@/server/suppliers/types";
import type { FlightSearchInput } from "@/lib/validation/search";
import {
  applyFilters,
  sortOffers,
  EMPTY_FILTERS,
  type Filters,
  type SortKey,
} from "@/lib/flights";
import { OfferCard } from "./offer-card";
import { OfferSkeletonList } from "./offer-skeleton";
import { FilterPanel } from "./filter-panel";
import { SortTabs } from "./sort-tabs";
import { DateStrip } from "./date-strip";
import { Card, CardBody } from "@/components/ui/card";

type Query = {
  origin: string;
  destination: string;
  departDate: string;
  returnDate?: string;
  adults: number;
  cabin: string;
  currency: string;
};

type Meta = { count: number; durationMs: number; fromCache: boolean; partial: boolean };
type Outcome =
  | { phase: "ready"; offers: PublicFlightOffer[]; meta: Meta }
  | { phase: "error"; message: string };

/**
 * The loading state is derived, not stored: a result is tagged with the date
 * it was fetched for, and anything else means a search is still in flight.
 * Setting a "loading" flag inside the effect would trigger a second render
 * before the first had painted.
 */
type Held = { key: string; outcome: Outcome };

export function FlightResults({
  query,
  search,
}: {
  query: Query;
  search: FlightSearchInput;
}) {
  const [held, setHeld] = useState<Held | null>(null);
  const [sort, setSort] = useState<SortKey>("best");
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [departDate, setDepartDate] = useState(query.departDate);

  const run = useCallback(
    async (date: string, signal: AbortSignal): Promise<Outcome | null> => {
      const params = new URLSearchParams({
        origin: query.origin,
        destination: query.destination,
        departDate: date,
        adults: String(query.adults),
        cabin: query.cabin,
        currency: query.currency,
      });
      if (query.returnDate) params.set("returnDate", query.returnDate);

      try {
        const response = await fetch(`/api/search/flights?${params}`, { signal });
        const body = (await response.json()) as {
          ok: boolean;
          offers?: PublicFlightOffer[];
          meta?: Meta;
          message?: string;
        };

        if (!response.ok || !body.ok || !body.offers || !body.meta) {
          return { phase: "error", message: body.message ?? "That search did not work." };
        }
        return { phase: "ready", offers: body.offers, meta: body.meta };
      } catch (error) {
        // An abort means a newer search replaced this one, which is not a failure.
        if (signal.aborted) return null;
        return {
          phase: "error",
          message: error instanceof Error ? error.message : "We could not reach the server.",
        };
      }
    },
    [query.origin, query.destination, query.returnDate, query.adults, query.cabin, query.currency],
  );

  useEffect(() => {
    const controller = new AbortController();
    void run(departDate, controller.signal).then((outcome) => {
      if (outcome === null) return;
      setHeld({ key: departDate, outcome });
      setFilters(EMPTY_FILTERS);
    });
    return () => controller.abort();
  }, [departDate, run]);

  const state = held?.key === departDate ? held.outcome : null;

  if (state === null) {
    return (
      <div className="flex flex-col gap-4">
        <DateStrip selected={departDate} onSelect={setDepartDate} />
        <OfferSkeletonList />
      </div>
    );
  }

  if (state.phase === "error") {
    return (
      <div className="flex flex-col gap-4">
        <DateStrip selected={departDate} onSelect={setDepartDate} />
        <Card>
          <CardBody className="flex flex-col items-start gap-2 py-10">
            <AlertTriangle className="size-6 text-crit" aria-hidden="true" />
            <h2 className="font-semibold">That search did not work</h2>
            <p className="text-sm text-fg-muted">{state.message}</p>
          </CardBody>
        </Card>
      </div>
    );
  }

  const visible = sortOffers(applyFilters(state.offers, filters), sort);
  const prices = state.offers.map((offer) => Number(offer.price.amount));
  const priceRange = {
    min: Math.min(...prices, 0),
    max: Math.max(...prices, 1),
  };
  const cheapestId = state.offers.reduce<PublicFlightOffer | null>(
    (best, offer) =>
      !best || Number(offer.price.amount) < Number(best.price.amount) ? offer : best,
    null,
  )?.offerId;

  return (
    <div className="flex flex-col gap-5">
      <DateStrip selected={departDate} onSelect={setDepartDate} />

      {state.meta.partial && (
        <div
          role="status"
          className="flex items-start gap-2.5 rounded-md border border-warn bg-brand-soft px-3.5 py-3 text-sm text-warn"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            One of our suppliers did not answer, so these results may not be the whole market.
          </span>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <FilterPanel
            offers={state.offers}
            filters={filters}
            onChange={setFilters}
            priceRange={priceRange}
          />
        </aside>

        <div className="flex min-w-0 flex-col gap-4">
          <SortTabs value={sort} onChange={setSort} />

          <p className="text-sm text-fg-muted">
            <span className="tabular">{visible.length}</span> of{" "}
            <span className="tabular">{state.offers.length}</span> flights
            {state.meta.fromCache && " · cached"}
          </p>

          {visible.length === 0 ? (
            <Card>
              <CardBody className="flex flex-col items-start gap-2 py-10">
                <SearchX className="size-6 text-fg-faint" aria-hidden="true" />
                <h2 className="font-semibold">Nothing matches those filters</h2>
                <p className="text-sm text-fg-muted">
                  Try allowing one stop, raising the maximum price, or a nearby date.
                </p>
              </CardBody>
            </Card>
          ) : (
            <ul className="flex flex-col gap-3">
              {visible.map((offer) => (
                <li key={offer.offerId}>
                  <OfferCard
                    offer={offer}
                    cheapest={offer.offerId === cheapestId}
                    search={{ ...search, departDate }}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
