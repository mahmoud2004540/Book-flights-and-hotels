"use client";

import type { PublicHotelOffer } from "@/server/suppliers/types";
import { amenityCounts, type HotelFilters } from "@/lib/hotels";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function HotelFilterPanel({
  hotels,
  filters,
  onChange,
  priceRange,
}: {
  hotels: PublicHotelOffer[];
  filters: HotelFilters;
  onChange: (next: HotelFilters) => void;
  priceRange: { min: number; max: number };
}) {
  const amenities = amenityCounts(hotels);
  const dirty =
    filters.maxPrice !== null ||
    filters.minStars !== null ||
    filters.amenities.length > 0 ||
    filters.freeCancellation;

  function toggleAmenity(code: string) {
    const next = filters.amenities.includes(code)
      ? filters.amenities.filter((value) => value !== code)
      : [...filters.amenities, code];
    onChange({ ...filters, amenities: next });
  }

  return (
    <Card>
      <CardBody className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Filters</h2>
          {dirty && (
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0"
              onClick={() =>
                onChange({ maxPrice: null, minStars: null, amenities: [], freeCancellation: false })
              }
            >
              Clear all
            </Button>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="hotel-max-price" className="text-xs font-medium text-fg-muted">
            Maximum total price
          </label>
          <input
            id="hotel-max-price"
            type="range"
            min={Math.floor(priceRange.min)}
            max={Math.ceil(priceRange.max)}
            value={filters.maxPrice ?? Math.ceil(priceRange.max)}
            onChange={(event) => onChange({ ...filters, maxPrice: Number(event.target.value) })}
            className="accent-brand"
          />
          <span className="text-sm tabular">
            up to {Math.round(filters.maxPrice ?? priceRange.max).toLocaleString("en-GB")}
          </span>
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-xs font-medium text-fg-muted">Star rating</legend>
          <div className="flex flex-wrap gap-2">
            {[null, 3, 4, 5].map((stars) => (
              <button
                key={stars ?? "any"}
                type="button"
                onClick={() => onChange({ ...filters, minStars: stars })}
                aria-pressed={filters.minStars === stars}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs transition-colors",
                  filters.minStars === stars
                    ? "border-brand bg-brand-soft text-brand"
                    : "border-line text-fg-muted hover:text-fg",
                )}
              >
                {stars === null ? "Any" : `${stars}+`}
              </button>
            ))}
          </div>
        </fieldset>

        <label className="flex cursor-pointer items-center gap-2.5 text-sm">
          <input
            type="checkbox"
            checked={filters.freeCancellation}
            onChange={(event) =>
              onChange({ ...filters, freeCancellation: event.target.checked })
            }
            className="size-4 accent-brand"
          />
          Free cancellation only
        </label>

        {amenities.length > 0 && (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-xs font-medium text-fg-muted">Amenities</legend>
            <div className="flex flex-col gap-1.5">
              {amenities.map((amenity) => (
                <label
                  key={amenity.code}
                  className="flex cursor-pointer items-center gap-2.5 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={filters.amenities.includes(amenity.code)}
                    onChange={() => toggleAmenity(amenity.code)}
                    className="size-4 accent-brand"
                  />
                  <span className="min-w-0 flex-1 truncate">{amenity.label}</span>
                  <span className="text-xs text-fg-faint tabular">{amenity.count}</span>
                </label>
              ))}
            </div>
          </fieldset>
        )}
      </CardBody>
    </Card>
  );
}
