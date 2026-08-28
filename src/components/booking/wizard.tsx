"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import type { Extras } from "@/lib/booking-types";
import type { Money, PublicFlightOffer } from "@/server/suppliers/types";
import type { PassengerInput } from "@/lib/validation/booking";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { FormStatus } from "@/components/auth/form-status";
import { OfferCard } from "@/components/flights/offer-card";
import { SessionTimer } from "./session-timer";
import { StepRail, STEP_LABELS, type StepIndex } from "./steps";
import { PriceNotice } from "./price-notice";
import { PassengerForm, emptyPassengers, type PassengerIssue } from "./passenger-form";
import { ExtrasForm } from "./extras-form";
import { ReviewStep } from "./review-step";
import { useBookingApi, type PriceResult } from "./use-booking-api";

export function BookingWizard({
  draftId,
  offer,
  quotedPrice,
  expiresAt,
  passengerCount,
  departDate,
  signedIn,
}: {
  draftId: string;
  offer: PublicFlightOffer;
  quotedPrice: Money;
  expiresAt: string;
  passengerCount: number;
  departDate: string;
  signedIn: boolean;
}) {
  const router = useRouter();
  const api = useBookingApi(draftId);

  const [step, setStep] = useState<StepIndex>(0);
  const [expired, setExpired] = useState(false);
  const [price, setPrice] = useState<PriceResult | null>(null);
  const [passengers, setPassengers] = useState<PassengerInput[]>(() =>
    emptyPassengers(passengerCount),
  );
  const [issues, setIssues] = useState<PassengerIssue[]>([]);
  const [extras, setExtras] = useState<Extras>({
    extraBags: 0,
    seatSelection: false,
    travelInsurance: false,
  });
  const [error, setError] = useState<string | null>(null);

  // Re-pricing runs on arrival at step 2, every time, with no cached shortcut.
  useEffect(() => {
    if (step !== 1 || price !== null) return;
    void api.confirmPrice().then((result) => {
      if (result.ok) setPrice(result.value);
      else setError(result.message);
    });
  }, [step, price, api]);

  const onExpired = useCallback(() => setExpired(true), []);

  if (expired) {
    return (
      <Card>
        <CardBody className="flex flex-col items-start gap-3 py-10">
          <h2 className="text-lg font-semibold">Your held price has expired</h2>
          <p className="max-w-md text-sm text-fg-muted">
            Fares are only held for a short time. Nothing has been booked and nothing has been
            charged — search again to see the current price.
          </p>
          <Button onClick={() => router.push("/")}>Start a new search</Button>
        </CardBody>
      </Card>
    );
  }

  async function next() {
    setError(null);

    if (step === 1) {
      if (price?.changed && !price.accepted) {
        setError("Accept the new price before continuing.");
        return;
      }
      setStep(2);
      return;
    }

    if (step === 2) {
      const result = await api.savePassengers(passengers, departDate);
      if (!result.ok) {
        setIssues(result.issues);
        setError(result.message);
        return;
      }
      setIssues([]);
      setStep(3);
      return;
    }

    if (step === 3) {
      const result = await api.saveExtras(extras);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setStep(4);
      return;
    }

    setStep((step + 1) as StepIndex);
  }

  const canAdvance =
    step < 4 && !api.pending && (step !== 1 || (price !== null && (!price.changed || price.accepted)));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <StepRail current={step} />
        <SessionTimer expiresAt={expiresAt} onExpired={onExpired} />
      </div>

      {error && <FormStatus tone="error">{error}</FormStatus>}

      <section aria-label={STEP_LABELS[step]} className="flex flex-col gap-4">
        {step === 0 && <OfferCard offer={offer} cheapest={false} />}

        {step === 1 &&
          (price === null ? (
            <p className="flex items-center gap-2 text-sm text-fg-muted">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Checking the current price with the airline…
            </p>
          ) : (
            <PriceNotice
              quoted={price.quoted}
              confirmed={price.confirmed}
              changed={price.changed}
              accepted={price.accepted}
              pending={api.pending}
              onAccept={() =>
                void api.acceptPrice().then((ok) => {
                  if (ok) setPrice({ ...price, accepted: true });
                })
              }
            />
          ))}

        {step === 2 && (
          <PassengerForm passengers={passengers} issues={issues} onChange={setPassengers} />
        )}

        {step === 3 && (
          <ExtrasForm
            extras={extras}
            passengers={passengers.length}
            currency={quotedPrice.currency}
            onChange={setExtras}
          />
        )}

        {step === 4 && price !== null && (
          <ReviewStep
            draftId={draftId}
            offer={offer}
            fare={price.confirmed}
            passengers={passengers}
            extras={extras}
            signedIn={signedIn}
            onError={setError}
          />
        )}
      </section>

      {step < 4 && (
        <div className="flex items-center justify-between border-t border-line pt-5">
          <Button
            variant="ghost"
            onClick={() => setStep(Math.max(0, step - 1) as StepIndex)}
            disabled={step === 0 || api.pending}
          >
            <ArrowLeft aria-hidden="true" />
            Back
          </Button>
          <Button onClick={() => void next()} disabled={!canAdvance}>
            {api.pending && <Loader2 className="animate-spin" aria-hidden="true" />}
            Continue
            <ArrowRight aria-hidden="true" />
          </Button>
        </div>
      )}
    </div>
  );
}
