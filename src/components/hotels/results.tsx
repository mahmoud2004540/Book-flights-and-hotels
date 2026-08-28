"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { AlertTriangle, List, Map as MapIcon, SearchX } from "lucide-react";
import type { PublicHotelOffer } from "@/server/suppliers/types";
import {
  EMPTY_HOTEL_FILTERS,
  filterHotels,
  sortHotels,
  type HotelFilters,
  type HotelSortKey,
} from "@/lib/hotels";
import { HotelCard } from "./hotel-card";
import { HotelFilterPanel } from "./hotel-filters";
import { Card, CardBody } from "@/components/ui/card";
import { OfferSkeletonList } from "@/components/flights/offer-skeleton";
import { cn } from "@/lib/utils";

/**
 * MapLibre touches window on import, so it is loaded client-side only.
 * Keeping it out of the server bundle also keeps it off the flights page.
 */
const HotelMap = dynamic(() => import("./hotel-map").then((m) => m.HotelMap), {
  ssr: false,
  loading: () => (
    <div className="h-[26rem] w-full animate-pulse rounded-card border border-line bg-surface-2 lg:h-[calc(100vh-9rem)]" />
  ),
});

type Query = {
  cityCode: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  rooms: number;
  currency: string;
};

type Meta = { count: number; durationMs: number; fromCache: boolean; partial: boolean };
type Outcome =
  | { phase: "ready"; hotels: PublicHotelOffer[]; meta: Meta }
  | { phase: "error"; message: string };

const SORTS: ReadonlyArray<{ key: HotelSortKey; label: string }> = [
  { key: "cheapest", label: "Price" },
  { key: "rating", label: "Rating" },
  { key: "distance", label: "Distance" },
];

export function HotelResults({ query }: { query: Query }) {
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [sort, setSort] = useState<HotelSortKey>("cheapest");
  const [filters, setFilters] = useState<HotelFilters>(EMPTY_HOTEL_FILTERS);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<"list" | "map">("list");

  const run = useCallback(
    async (signal: AbortSignal): Promise<Outcome | null> => {
      const params = new URLSearchParams({
        cityCode: query.cityCode,
        checkIn: query.checkIn,
        checkOut: query.checkOut,
        adults: String(query.adults),
        rooms: String(query.rooms),
        currency: query.currency,
      });

      try {
        const response = await fetch(`/api/search/hotels?${params}`, { signal });
        const body = (await response.json()) as {
          ok: boolean;
          hotels?: PublicHotelOffer[];
          meta?: Meta;
          message?: string;
        };

        if (!response.ok || !body.ok || !body.hotels || !body.meta) {
          return { phase: "error", message: body.message ?? "That search did not work." };
        }
        return { phase: "ready", hotels: body.hotels, meta: body.meta };
      } catch (error) {
        if (signal.aborted) return null;
        return {
          phase: "error",
          message: error instanceof Error ? error.message : "We could not reach the server.",
        };
      }
    },
    [query.cityCode, query.checkIn, query.checkOut, query.adults, query.rooms, query.currency],
  );

  useEffect(() => {
    const controller = new AbortController();
    void run(controller.signal).then((result) => {
      if (result !== null) setOutcome(result);
    });
    return () => controller.abort();
  }, [run]);

  // Held in a memo because a fresh [] on every render would defeat the memo below.
  const hotels = useMemo(
    () => (outcome?.phase === "ready" ? outcome.hotels : []),
    [outcome],
  );
  const visible = useMemo(
    () => sortHotels(filterHotels(hotels, filters), sort),
    [hotels, filters, sort],
  );

  if (outcome === null) return <OfferSkeletonList count={5} />;

  if (outcome.phase === "error") {
    return (
      <Card>
        <CardBody className="flex flex-col items-start gap-2 py-10">
          <AlertTriangle className="size-6 text-crit" aria-hidden="true" />
          <h2 className="font-semibold">That search did not work</h2>
          <p className="text-sm text-fg-muted">{outcome.message}</p>
        </CardBody>
      </Card>
    );
  }

  const prices = hotels.map((hotel) => Number(hotel.fromPrice.amount));
  const priceRange = { min: Math.min(...prices, 0), max: Math.max(...prices, 1) };

  return (
    <div className="flex flex-col gap-5">
      {outcome.meta.partial && (
        <div
          role="status"
          className="flex items-start gap-2.5 rounded-md border border-warn bg-brand-soft px-3.5 py-3 text-sm text-warn"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>One of our suppliers did not answer, so these results may be incomplete.</span>
        </div>
      )}

      {/* One pane at a time on a phone; both side by side from large up. */}
      <div className="flex gap-2 lg:hidden">
        {(["list", "map"] as const).map((view) => (
          <button
            key={view}
            type="button"
            onClick={() => setMobileView(view)}
            aria-pressed={mobileView === view}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-md border px-4 py-2 text-sm font-medium",
              mobileView === view
                ? "border-brand bg-brand-soft text-brand"
                : "border-line text-fg-muted",
            )}
          >
            {view === "list" ? <List className="size-4" /> : <MapIcon className="size-4" />}
            {view === "list" ? "List" : "Map"}
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[240px_1fr_1fr]">
        <aside className={cn("lg:block", mobileView === "map" && "hidden")}>
          <HotelFilterPanel
            hotels={hotels}
            filters={filters}
            onChange={setFilters}
            priceRange={priceRange}
          />
        </aside>

        <div className={cn("flex min-w-0 flex-col gap-4 lg:block", mobileView === "map" && "hidden")}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-fg-muted">
              <span className="tabular">{visible.length}</span> of{" "}
              <span className="tabular">{hotels.length}</span> hotels
              {outcome.meta.fromCache && " · cached"}
            </p>
            <div role="tablist" aria-label="Sort hotels" className="flex gap-1">
              {SORTS.map((option) => (
                <button
                  key={option.key}
                  role="tab"
                  type="button"
                  aria-selected={sort === option.key}
                  onClick={() => setSort(option.key)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                    sort === option.key
                      ? "bg-brand-soft text-brand"
                      : "text-fg-muted hover:bg-surface-2 hover:text-fg",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {visible.length === 0 ? (
            <Card>
              <CardBody className="flex flex-col items-start gap-2 py-10">
                <SearchX className="size-6 text-fg-faint" aria-hidden="true" />
                <h2 className="font-semibold">Nothing matches those filters</h2>
                <p className="text-sm text-fg-muted">
                  Try fewer amenities, a lower star rating, or a higher price ceiling.
                </p>
              </CardBody>
            </Card>
          ) : (
            <ul className="mt-4 flex flex-col gap-3">
              {visible.map((hotel) => (
                <li key={hotel.hotelId}>
                  <HotelCard
                    hotel={hotel}
                    active={activeId === hotel.hotelId}
                    onHover={setActiveId}
                    onSelect={setActiveId}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>

        <div
          className={cn(
            "lg:sticky lg:top-20 lg:block lg:self-start",
            mobileView === "list" && "hidden",
          )}
        >
          <HotelMap hotels={visible} activeId={activeId} onSelect={setActiveId} />
        </div>
      </div>
    </div>
  );
}
