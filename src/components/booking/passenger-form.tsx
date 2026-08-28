"use client";

import type { PassengerInput } from "@/lib/validation/booking";
import { Field, Input, Select } from "@/components/ui/field";
import { Card, CardBody } from "@/components/ui/card";

export type PassengerIssue = { index: number; field: string; message: string };

const EMPTY: PassengerInput = {
  firstName: "",
  lastName: "",
  dob: "",
  nationality: "",
  passportNumber: "",
  passportExpiry: "",
  type: "ADULT",
};

export function emptyPassengers(count: number): PassengerInput[] {
  return Array.from({ length: count }, () => ({ ...EMPTY }));
}

/** Step 3 — one card per traveller, named as in the passport. */
export function PassengerForm({
  passengers,
  issues,
  onChange,
}: {
  passengers: PassengerInput[];
  issues: PassengerIssue[];
  onChange: (next: PassengerInput[]) => void;
}) {
  function update(index: number, patch: Partial<PassengerInput>) {
    onChange(passengers.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  }

  function errorFor(index: number, field: string): string | undefined {
    return issues.find((issue) => issue.index === index && issue.field === field)?.message;
  }

  return (
    <div className="flex flex-col gap-4">
      {passengers.map((passenger, index) => (
        <Card key={index}>
          <CardBody className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Traveller {index + 1}</h3>
              <Select
                aria-label={`Fare type for traveller ${index + 1}`}
                value={passenger.type}
                onChange={(event) =>
                  update(index, { type: event.target.value as PassengerInput["type"] })
                }
                className="h-9 w-auto"
              >
                <option value="ADULT">Adult</option>
                <option value="CHILD">Child (2–11)</option>
                <option value="INFANT">Infant (under 2)</option>
              </Select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="First name"
                htmlFor={`first-${index}`}
                hint="Exactly as printed in the passport"
                error={errorFor(index, "firstName")}
              >
                <Input
                  id={`first-${index}`}
                  value={passenger.firstName}
                  onChange={(event) => update(index, { firstName: event.target.value })}
                  autoComplete="off"
                  required
                />
              </Field>
              <Field
                label="Last name"
                htmlFor={`last-${index}`}
                error={errorFor(index, "lastName")}
              >
                <Input
                  id={`last-${index}`}
                  value={passenger.lastName}
                  onChange={(event) => update(index, { lastName: event.target.value })}
                  autoComplete="off"
                  required
                />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Date of birth" htmlFor={`dob-${index}`} error={errorFor(index, "dob")}>
                <Input
                  id={`dob-${index}`}
                  type="date"
                  value={passenger.dob}
                  onChange={(event) => update(index, { dob: event.target.value })}
                  required
                />
              </Field>
              <Field
                label="Nationality"
                htmlFor={`nat-${index}`}
                hint="Two-letter code"
                error={errorFor(index, "nationality")}
              >
                <Input
                  id={`nat-${index}`}
                  value={passenger.nationality}
                  onChange={(event) =>
                    update(index, { nationality: event.target.value.toUpperCase() })
                  }
                  maxLength={2}
                  required
                />
              </Field>
              <Field
                label="Passport number"
                htmlFor={`passport-${index}`}
                error={errorFor(index, "passportNumber")}
              >
                <Input
                  id={`passport-${index}`}
                  value={passenger.passportNumber}
                  onChange={(event) =>
                    update(index, { passportNumber: event.target.value.toUpperCase() })
                  }
                  autoComplete="off"
                  required
                />
              </Field>
            </div>

            <Field
              label="Passport expiry"
              htmlFor={`expiry-${index}`}
              hint="Most countries require six months of validity after arrival"
              error={errorFor(index, "passportExpiry")}
              className="sm:max-w-xs"
            >
              <Input
                id={`expiry-${index}`}
                type="date"
                value={passenger.passportExpiry}
                onChange={(event) => update(index, { passportExpiry: event.target.value })}
                required
              />
            </Field>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}
