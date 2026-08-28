"use client";

import type { SortKey } from "@/lib/flights";
import { cn } from "@/lib/utils";

const OPTIONS: ReadonlyArray<{ key: SortKey; label: string; hint: string }> = [
  { key: "best", label: "Best", hint: "Balances price and duration" },
  { key: "cheapest", label: "Cheapest", hint: "Lowest total price" },
  { key: "fastest", label: "Fastest", hint: "Shortest total time" },
];

export function SortTabs({
  value,
  onChange,
}: {
  value: SortKey;
  onChange: (key: SortKey) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Sort results"
      className="flex overflow-hidden rounded-md border border-line bg-surface"
    >
      {OPTIONS.map((option) => (
        <button
          key={option.key}
          role="tab"
          type="button"
          aria-selected={value === option.key}
          title={option.hint}
          onClick={() => onChange(option.key)}
          className={cn(
            "flex-1 px-4 py-2.5 text-sm font-medium transition-colors",
            value === option.key
              ? "bg-brand-soft text-brand"
              : "text-fg-muted hover:bg-surface-2 hover:text-fg",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
