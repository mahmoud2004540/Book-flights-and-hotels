"use client";

import { useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { EXTRA_PRICES, type Extras } from "@/lib/booking-types";
import type { Money, PublicFlightOffer } from "@/server/suppliers/types";
import type { PassengerInput } from "@/lib/validation/booking";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { formatClock } from "@/lib/flights";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-sm">
      <span className="text-fg-muted">{label}</span>
      <span className="tabular">{value}</span>
    </div>
  );
}

/** Step 5 — the full summary, terms, and the button that creates the booking. */
export function ReviewStep({
  draftId,
  offer,
  fare,
  passengers,
  extras,
  signedIn,
  onError,
}: {
  draftId: string;
  offer: PublicFlightOffer;
  fare: Money;
  passengers: PassengerInput[];
  extras: Extras;
  signedIn: boolean;
  onError: (message: string) => void;
}) {
  const router = useRouter();
  const [accepted, setAccepted] = useState(false);
  const [guestEmail, setGuestEmail] = useState("");
  const [pending, setPending] = useState(false);

  /**
   * Generated once and reused for every retry of this booking.
   * A key made fresh on each click would defeat the whole guard — two clicks
   * would carry two keys and create two bookings.
   */
  const idempotencyKey = useRef(crypto.randomUUID());

  const people = Math.max(passengers.length, 1);
  const bags = extras.extraBags * EXTRA_PRICES.bag * people;
  const seats = extras.seatSelection ? EXTRA_PRICES.seat * people : 0;
  const insurance = extras.travelInsurance ? EXTRA_PRICES.insurance * people : 0;
  const total = Number(fare.amount) + bags + seats + insurance;

  async function confirm() {
    setPending(true);
    try {
      const response = await fetch(`/api/booking/${draftId}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idempotencyKey: idempotencyKey.current,
          acceptedTerms: true,
          guestEmail: signedIn ? undefined : guestEmail,
        }),
      });
      const body = (await response.json()) as { ok?: boolean; reference?: string; reason?: string };

      if (body.ok && body.reference) {
        router.push(`/booking/confirmed/${body.reference}`);
        return;
      }
      onError(
        body.reason === "expired"
          ? "Your held price has expired. Search again to see the current fare."
          : "We could not complete the booking. Try again.",
      );
    } catch {
      onError("We could not reach the server. Try again.");
    } finally {
      setPending(false);
    }
  }

  const first = offer.itineraries[0]?.segments[0];
  const last = offer.itineraries[0]?.segments.at(-1);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardBody className="flex flex-col gap-3">
          <h3 className="font-semibold">Your flight</h3>
          {first && last && (
            <p className="text-sm text-fg-muted tabular">
              {first.carrierName ?? first.carrierCode} · {first.from.code} {formatClock(first.from.at)}{" "}
              → {last.to.code} {formatClock(last.to.at)}
            </p>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardBody className="flex flex-col gap-3">
          <h3 className="font-semibold">Travellers</h3>
          <ul className="flex flex-col gap-1 text-sm">
            {passengers.map((passenger, index) => (
              <li key={index} className="flex justify-between gap-4">
                <span>
                  {passenger.firstName} {passenger.lastName}
                </span>
                <span className="text-fg-muted">{passenger.type.toLowerCase()}</span>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="flex flex-col gap-2">
          <h3 className="mb-1 font-semibold">Price</h3>
          <Row
            label={`Fare for ${people} traveller${people > 1 ? "s" : ""}`}
            value={`${fare.currency} ${Number(fare.amount).toLocaleString("en-GB")}`}
          />
          {bags > 0 && <Row label={`Extra bags (${extras.extraBags} each)`} value={`${fare.currency} ${bags}`} />}
          {seats > 0 && <Row label="Seat selection" value={`${fare.currency} ${seats}`} />}
          {insurance > 0 && <Row label="Travel insurance" value={`${fare.currency} ${insurance}`} />}
          <div className="mt-2 flex items-baseline justify-between gap-4 border-t border-line pt-3">
            <span className="font-semibold">Total, taxes included</span>
            <span className="text-xl font-semibold tabular">
              {fare.currency} {total.toLocaleString("en-GB")}
            </span>
          </div>
        </CardBody>
      </Card>

      {!signedIn && (
        <Card>
          <CardBody>
            <Field
              label="Email for your confirmation"
              htmlFor="guest-email"
              hint="We send your booking reference and ticket here."
            >
              <Input
                id="guest-email"
                type="email"
                value={guestEmail}
                onChange={(event) => setGuestEmail(event.target.value)}
                autoComplete="email"
                required
              />
            </Field>
          </CardBody>
        </Card>
      )}

      <label className="flex cursor-pointer items-start gap-3 text-sm">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(event) => setAccepted(event.target.checked)}
          className="mt-0.5 size-4 accent-brand"
        />
        <span>
          I accept the terms and conditions, and the airline&rsquo;s fare rules for
          cancellation and changes.
        </span>
      </label>

      <Button
        size="lg"
        onClick={() => void confirm()}
        disabled={pending || !accepted || (!signedIn && guestEmail.length === 0)}
      >
        {pending && <Loader2 className="animate-spin" aria-hidden="true" />}
        Confirm booking
      </Button>

      <p className="text-xs text-fg-faint">
        Payment is wired up in the next stage. Confirming now records the booking and holds it
        for you.
      </p>
    </div>
  );
}
