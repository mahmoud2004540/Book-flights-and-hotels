"use client";

import { useId, useState } from "react";
import type { DayPoint } from "@/server/admin/stats";

/**
 * Bookings per day.
 *
 * One series, so no legend — the caption names it. Only the busiest day and the
 * ends are labelled: a number over every bar is noise at thirty of them, and the
 * rest are one hover away. The table underneath is the same data for a screen
 * reader, and for anyone who wants the figures rather than the shape.
 */
export function BookingsChart({ points }: { points: DayPoint[] }) {
  const tableId = useId();
  const [hover, setHover] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);

  const max = Math.max(1, ...points.map((p) => p.bookings));
  const busiest = points.reduce(
    (best, point, index) => (point.bookings > (points[best]?.bookings ?? -1) ? index : best),
    0,
  );
  const total = points.reduce((sum, point) => sum + point.bookings, 0);

  const label = (day: string) =>
    new Date(`${day}T00:00:00Z`).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    });

  return (
    <figure className="m-0 flex flex-col gap-3">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-semibold">Bookings per day</span>
        <span className="text-xs text-fg-muted tabular">
          {total} over {points.length} days
        </span>
      </figcaption>

      <div className="relative">
        {/* A single recessive reference line at the peak, so bar heights are
            readable as a quantity rather than only against each other. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 flex justify-end border-t border-dashed border-line"
        >
          <span className="bg-surface pl-1 text-[10px] text-fg-faint tabular">{max}</span>
        </div>

        <ul className="flex h-32 items-end gap-[2px]" role="list">
          {points.map((point, index) => {
            const height = (point.bookings / max) * 100;
            const active = hover === index;
            return (
              <li
                key={point.day}
                className="relative flex h-full flex-1 items-end"
                onMouseEnter={() => setHover(index)}
                onMouseLeave={() => setHover(null)}
              >
                <div
                  className="w-full rounded-t-[4px] bg-chart-1 transition-opacity"
                  style={{ height: `${Math.max(height, point.bookings > 0 ? 3 : 0)}%`, opacity: active ? 1 : 0.85 }}
                />
                {active && (
                  <div
                    role="status"
                    className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 rounded-md border border-line bg-surface px-2 py-1 text-xs whitespace-nowrap shadow-md"
                  >
                    <span className="font-medium tabular">{point.bookings}</span>{" "}
                    <span className="text-fg-muted">on {label(point.day)}</span>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <div className="flex items-baseline justify-between text-[10px] text-fg-faint tabular">
        <span>{points[0] && label(points[0].day)}</span>
        <span className="text-fg-muted">
          busiest {points[busiest] && label(points[busiest].day)}
        </span>
        <span>{points.at(-1) && label(points.at(-1)!.day)}</span>
      </div>

      <div>
        <button
          type="button"
          onClick={() => setShowTable((open) => !open)}
          aria-expanded={showTable}
          aria-controls={tableId}
          className="text-xs text-fg-muted underline underline-offset-2 hover:text-fg"
        >
          {showTable ? "Hide the figures" : "Show the figures"}
        </button>

        <div id={tableId} hidden={!showTable} className="mt-2 max-h-48 overflow-y-auto">
          <table className="w-full text-xs">
            <caption className="sr-only">Bookings per day</caption>
            <thead className="text-fg-muted">
              <tr>
                <th scope="col" className="py-1 text-start font-medium">Day</th>
                <th scope="col" className="py-1 text-end font-medium">Bookings</th>
              </tr>
            </thead>
            <tbody>
              {points.map((point) => (
                <tr key={point.day} className="border-t border-line-soft">
                  <td className="py-1">{label(point.day)}</td>
                  <td className="py-1 text-end tabular">{point.bookings}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </figure>
  );
}
