"use client";

import type { PublicFlightOffer } from "@/server/suppliers/types";
import { carrierCounts, type Filters } from "@/lib/flights";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Result filters — section 4.2. */
export function FilterPanel({
  offers,
  filters,
  onChange,
  priceRange,
}: {
  offers: PublicFlightOffer[];
  filters: Filters;
  onChange: (next: Filters) => void;
  priceRange: { min: number; max: number };
}) {
  const carriers = carrierCounts(offers);
  const hasFilters =
    filters.maxPrice !== null || filters.maxStops !== null || filters.carriers.length > 0;

  function toggleCarrier(code: string) {
    const next = filters.carriers.includes(code)
      ? filters.carriers.filter((c) => c !== code)
      : [...filters.carriers, code];
    onChange({ ...filters, carriers: next });
  }

  return (
    <Card>
      <CardBody className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Filters</h2>
          {hasFilters && (
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0"
              onClick={() => onChange({ maxPrice: null, maxStops: null, carriers: [] })}
            >
              Clear all
            </Button>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="max-price" className="text-xs font-medium text-fg-muted">
            Maximum price
          </label>
          <input
            id="max-price"
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
          <legend className="mb-1 text-xs font-medium text-fg-muted">Stops</legend>
          <div className="flex flex-wrap gap-2">
            {[
              { label: "Any", value: null },
              { label: "Direct", value: 0 },
              { label: "1 stop", value: 1 },
            ].map((option) => (
              <button
                key={option.label}
                type="button"
                onClick={() => onChange({ ...filters, maxStops: option.value })}
                aria-pressed={filters.maxStops === option.value}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs transition-colors",
                  filters.maxStops === option.value
                    ? "border-brand bg-brand-soft text-brand"
                    : "border-line text-fg-muted hover:text-fg",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </fieldset>

        {carriers.length > 1 && (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-xs font-medium text-fg-muted">Airlines</legend>
            <div className="flex flex-col gap-1.5">
              {carriers.map((carrier) => (
                <label
                  key={carrier.code}
                  className="flex cursor-pointer items-center gap-2.5 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={filters.carriers.includes(carrier.code)}
                    onChange={() => toggleCarrier(carrier.code)}
                    className="size-4 accent-brand"
                  />
                  <span className="min-w-0 flex-1 truncate">{carrier.name}</span>
                  <span className="text-xs text-fg-faint tabular">{carrier.count}</span>
                </label>
              ))}
            </div>
          </fieldset>
        )}
      </CardBody>
    </Card>
  );
}
