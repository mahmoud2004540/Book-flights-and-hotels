"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useRouter } from "@/i18n/navigation";

/**
 * A switch that sends one PATCH and shows what came back.
 *
 * Shared by markup rules and suppliers because both refusals are the same
 * shape: the server may say no for a reason the person needs to read — "this is
 * the only active supplier" — and that has to land next to the control.
 */
export function ToggleRow({
  endpoint,
  field,
  value,
  labelOn,
  labelOff,
  describedAs,
}: {
  endpoint: string;
  field: string;
  value: boolean;
  labelOn: string;
  labelOff: string;
  describedAs: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(endpoint, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ [field]: !value }),
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
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending}
        aria-label={`${value ? labelOff : labelOn} ${describedAs}`}
        onClick={() => void toggle()}
        className="inline-flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1 text-xs font-medium hover:bg-surface-2 disabled:opacity-60"
      >
        {pending && <Loader2 className="size-3 animate-spin" aria-hidden="true" />}
        {value ? labelOff : labelOn}
      </button>
      {error && (
        <span role="alert" className="max-w-56 text-end text-xs text-crit">
          {error}
        </span>
      )}
    </div>
  );
}
