"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FormStatus } from "@/components/auth/form-status";

/**
 * Adds a markup rule.
 *
 * Every scope field is optional and empty means "everything", which is how the
 * catch-all rule is written. The priority note is on screen rather than in a
 * manual, because a rule at the wrong priority silently never applies.
 */
export function MarkupForm({ suppliers }: { suppliers: Array<{ id: string; name: string }> }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/markup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          supplierId: form.get("supplierId"),
          serviceType: form.get("serviceType"),
          destination: form.get("destination"),
          type: form.get("type"),
          value: form.get("value"),
          priority: form.get("priority"),
          isActive: true,
        }),
      });
      const result = (await response.json()) as { ok?: boolean; reason?: string };
      if (!result.ok) {
        setError(result.reason ?? "That rule was not accepted.");
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError("We could not reach the server.");
    } finally {
      setPending(false);
    }
  }

  if (!open) {
    return (
      <Button variant="outline" onClick={() => setOpen(true)} className="self-start">
        Add a rule
      </Button>
    );
  }

  return (
    <Card>
      <CardBody>
        <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-4">
          <h2 className="font-semibold">Add a markup rule</h2>
          {error && <FormStatus tone="error">{error}</FormStatus>}

          <div className="grid gap-3 sm:grid-cols-2">
            <Labelled label="Supplier" hint="Empty applies to all suppliers">
              <select name="supplierId" defaultValue="" className={FIELD}>
                <option value="">All suppliers</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
            </Labelled>

            <Labelled label="Service" hint="Empty applies to both">
              <select name="serviceType" defaultValue="" className={FIELD}>
                <option value="">Flights and hotels</option>
                <option value="FLIGHT">Flights</option>
                <option value="HOTEL">Hotels</option>
              </select>
            </Labelled>

            <Labelled label="Destination" hint="An IATA code or country. Empty is everywhere">
              <input name="destination" placeholder="DXB" className={FIELD} />
            </Labelled>

            <Labelled label="Type">
              <select name="type" defaultValue="PERCENT" className={FIELD}>
                <option value="PERCENT">Percentage</option>
                <option value="FIXED">Fixed amount</option>
              </select>
            </Labelled>

            <Labelled label="Value">
              <input
                name="value"
                type="number"
                step="0.01"
                min="0"
                required
                defaultValue="4.5"
                className={FIELD}
              />
            </Labelled>

            <Labelled label="Priority" hint="Lower wins. A specific rule needs a lower number than the catch-all">
              <input
                name="priority"
                type="number"
                min="1"
                required
                defaultValue="100"
                className={FIELD}
              />
            </Labelled>
          </div>

          <div className="flex gap-2">
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin" aria-hidden="true" />}
              Add the rule
            </Button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

const FIELD = "w-full rounded-md border border-line bg-surface px-3 py-2 text-sm";

function Labelled({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{label}</span>
      {children}
      {hint && <span className="text-xs text-fg-faint">{hint}</span>}
    </label>
  );
}
