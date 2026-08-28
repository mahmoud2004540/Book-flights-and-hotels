"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The visible countdown the brief requires — section 4.5.
 *
 * A held fare that expires silently leaves the traveller filling in passport
 * numbers against a price that is already gone, so the remaining time is shown
 * throughout rather than only when it runs out.
 */
export function SessionTimer({
  expiresAt,
  onExpired,
}: {
  expiresAt: string;
  onExpired: () => void;
}) {
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, new Date(expiresAt).getTime() - Date.now()),
  );

  useEffect(() => {
    const deadline = new Date(expiresAt).getTime();
    const tick = () => {
      const left = Math.max(0, deadline - Date.now());
      setRemaining(left);
      if (left === 0) onExpired();
    };

    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [expiresAt, onExpired]);

  const totalSeconds = Math.floor(remaining / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const urgent = totalSeconds <= 120;

  return (
    <div
      role="timer"
      aria-live={urgent ? "polite" : "off"}
      className={cn(
        "flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm",
        urgent ? "border-crit bg-crit-soft text-crit" : "border-line bg-surface text-fg-muted",
      )}
    >
      <Clock className="size-4 shrink-0" aria-hidden="true" />
      <span>
        Price held for{" "}
        <span className="font-semibold tabular">
          {minutes}:{String(seconds).padStart(2, "0")}
        </span>
      </span>
    </div>
  );
}
