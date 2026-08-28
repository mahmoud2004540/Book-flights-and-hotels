"use client";

import { cn } from "@/lib/utils";

/**
 * The ±3 day date strip — section 4.2.
 *
 * Only dates, no prices yet. Filling in a price per day means one search per
 * day, which belongs behind the cheapest-dates endpoint rather than seven
 * parallel full searches.
 */
function shiftDate(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function label(iso: string): { weekday: string; day: string } {
  const date = new Date(`${iso}T00:00:00Z`);
  return {
    weekday: date.toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" }),
    day: date.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }),
  };
}

export function DateStrip({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (date: string) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const dates = [-3, -2, -1, 0, 1, 2, 3]
    .map((offset) => shiftDate(selected, offset))
    // A date in the past is not bookable, so it is dropped rather than shown disabled.
    .filter((date) => date >= today);

  return (
    <div className="overflow-x-auto">
      <div role="group" aria-label="Nearby dates" className="flex min-w-max gap-2">
        {dates.map((date) => {
          const { weekday, day } = label(date);
          const isSelected = date === selected;
          return (
            <button
              key={date}
              type="button"
              onClick={() => onSelect(date)}
              aria-pressed={isSelected}
              className={cn(
                "flex min-w-[5.5rem] flex-col items-center rounded-md border px-3 py-2 transition-colors",
                isSelected
                  ? "border-brand bg-brand-soft text-brand"
                  : "border-line bg-surface text-fg-muted hover:text-fg",
              )}
            >
              <span className="text-xs">{weekday}</span>
              <span className="text-sm font-medium tabular">{day}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
