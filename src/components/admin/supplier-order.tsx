"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { useRouter } from "@/i18n/navigation";

/**
 * Moves a supplier up or down the tie-break order.
 *
 * Up and down rather than a number, because "lower priority wins" is the
 * model the code uses and the wrong thing to put in front of someone deciding
 * which supplier they would rather sell. The server does the swap; this only
 * says which way.
 */
export function SupplierOrder({
  supplierId,
  name,
  isFirst,
  isLast,
}: {
  supplierId: string;
  name: string;
  isFirst: boolean;
  isLast: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<"up" | "down" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function move(direction: "up" | "down") {
    setPending(direction);
    setError(null);
    try {
      const response = await fetch(`/api/admin/suppliers/${supplierId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ move: direction }),
      });
      const result = (await response.json()) as { ok?: boolean; reason?: string };
      if (!result.ok) {
        setError(result.reason ?? "That did not work.");
        return;
      }
      router.refresh();
    } catch {
      setError("We could not reach the server.");
    } finally {
      setPending(null);
    }
  }

  const button =
    "inline-flex size-7 items-center justify-center rounded-md border border-line hover:bg-surface-2 disabled:opacity-40 disabled:hover:bg-transparent";

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex gap-1">
        <button
          type="button"
          className={button}
          disabled={isFirst || pending !== null}
          aria-label={`Move ${name} up`}
          onClick={() => void move("up")}
        >
          {pending === "up" ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <ChevronUp className="size-3.5" aria-hidden="true" />
          )}
        </button>
        <button
          type="button"
          className={button}
          disabled={isLast || pending !== null}
          aria-label={`Move ${name} down`}
          onClick={() => void move("down")}
        >
          {pending === "down" ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <ChevronDown className="size-3.5" aria-hidden="true" />
          )}
        </button>
      </div>
      {error && (
        <span role="alert" className="max-w-40 text-xs text-crit">
          {error}
        </span>
      )}
    </div>
  );
}
