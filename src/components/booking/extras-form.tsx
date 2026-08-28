"use client";

import { Armchair, Briefcase, ShieldCheck } from "lucide-react";
import { EXTRA_PRICES, type Extras } from "@/lib/booking-types";
import { Card, CardBody } from "@/components/ui/card";
import { Input } from "@/components/ui/field";

/** Step 4 — extras, priced per traveller the way airlines charge them. */
export function ExtrasForm({
  extras,
  passengers,
  currency,
  onChange,
}: {
  extras: Extras;
  passengers: number;
  currency: string;
  onChange: (next: Extras) => void;
}) {
  const people = Math.max(passengers, 1);

  return (
    <div className="flex flex-col gap-3">
      <Card>
        <CardBody className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Briefcase className="mt-0.5 size-5 text-fg-muted" aria-hidden="true" />
            <div>
              <label htmlFor="extra-bags" className="font-medium">
                Extra checked bags
              </label>
              <p className="text-sm text-fg-muted tabular">
                {currency} {EXTRA_PRICES.bag} per bag, per traveller
              </p>
            </div>
          </div>
          <Input
            id="extra-bags"
            type="number"
            min={0}
            max={5}
            value={extras.extraBags}
            onChange={(event) =>
              onChange({ ...extras, extraBags: Math.max(0, Number(event.target.value)) })
            }
            className="tabular w-24"
          />
        </CardBody>
      </Card>

      {(
        [
          {
            key: "seatSelection" as const,
            Icon: Armchair,
            label: "Choose your seats",
            price: EXTRA_PRICES.seat,
          },
          {
            key: "travelInsurance" as const,
            Icon: ShieldCheck,
            label: "Travel insurance",
            price: EXTRA_PRICES.insurance,
          },
        ]
      ).map(({ key, Icon, label, price }) => (
        <Card key={key}>
          <CardBody>
            <label className="flex cursor-pointer flex-wrap items-center justify-between gap-4">
              <span className="flex items-start gap-3">
                <Icon className="mt-0.5 size-5 text-fg-muted" aria-hidden="true" />
                <span>
                  <span className="font-medium">{label}</span>
                  <span className="block text-sm text-fg-muted tabular">
                    {currency} {price} per traveller · {currency} {price * people} total
                  </span>
                </span>
              </span>
              <input
                type="checkbox"
                checked={extras[key]}
                onChange={(event) => onChange({ ...extras, [key]: event.target.checked })}
                className="size-4 accent-brand"
              />
            </label>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}
