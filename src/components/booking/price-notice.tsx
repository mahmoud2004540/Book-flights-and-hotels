import { AlertTriangle, CheckCircle2 } from "lucide-react";
import type { Money } from "@/server/suppliers/types";
import { Button } from "@/components/ui/button";
import { formatAmount } from "@/lib/format";

/**
 * The result of re-pricing — section 4.5.
 *
 * When the fare has moved, continuing requires an explicit click. The old and
 * new prices are both shown, because "the price changed" without the numbers
 * is not something a traveller can make a decision on.
 */
export function PriceNotice({
  quoted,
  confirmed,
  changed,
  accepted,
  onAccept,
  pending,
}: {
  quoted: Money;
  confirmed: Money;
  changed: boolean;
  accepted: boolean;
  onAccept: () => void;
  pending: boolean;
}) {
  if (!changed) {
    return (
      <div
        role="status"
        data-price-state="unchanged"
        className="flex items-start gap-2.5 rounded-md border border-accent bg-accent-soft px-4 py-3.5 text-sm text-accent"
      >
        <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span>
          The price is confirmed at{" "}
          <span className="font-semibold tabular">
            {formatAmount(confirmed.amount, confirmed.currency)}
          </span>
          . Nothing has changed since you searched.
        </span>
      </div>
    );
  }

  const difference = Number(confirmed.amount) - Number(quoted.amount);
  const rose = difference > 0;

  return (
    <div
      role="alert"
      data-price-state={accepted ? "accepted" : "changed"}
      className="flex flex-col gap-3 rounded-md border border-warn bg-brand-soft px-4 py-3.5 text-sm"
    >
      <div className="flex items-start gap-2.5 text-warn">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <div>
          <p className="font-semibold">
            The airline has {rose ? "raised" : "lowered"} this fare since you searched.
          </p>
          <p className="mt-1">
            You saw{" "}
            <span className="tabular line-through">
              {formatAmount(quoted.amount, quoted.currency)}
            </span>
            . It is now{" "}
            <span className="font-semibold tabular">
              {formatAmount(confirmed.amount, confirmed.currency)}
            </span>{" "}
            — {rose ? "an increase" : "a decrease"} of{" "}
            <span className="tabular">
              {formatAmount(Math.abs(difference), confirmed.currency)}
            </span>
            .
          </p>
        </div>
      </div>

      {accepted ? (
        <p className="text-xs text-fg-muted">You accepted the new price.</p>
      ) : (
        <Button size="sm" onClick={onAccept} disabled={pending} className="self-start">
          Accept the new price and continue
        </Button>
      )}
    </div>
  );
}
