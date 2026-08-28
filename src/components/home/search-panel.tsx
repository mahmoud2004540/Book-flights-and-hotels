"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeftRight, Building2, Plane, Search } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { PlaceInput } from "./place-input";
import { cn } from "@/lib/utils";

/** Tomorrow, as the default departure date — today's flights are mostly gone. */
function defaultDepartDate(): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

/** Three nights after check-in, so the hotel form is valid before it is touched. */
function defaultCheckOutDate(): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + 4);
  return date.toISOString().slice(0, 10);
}

type Tab = "flights" | "hotels";

/**
 * The search box — section 4.1.
 * Flights submit to the results page; hotels arrive in stage 3.
 */
export function SearchPanel() {
  const t = useTranslations("search");
  const tHome = useTranslations("home");
  const [tab, setTab] = useState<Tab>("flights");
  const id = useId();
  const router = useRouter();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const params = new URLSearchParams();

    const fields =
      tab === "flights"
        ? ["origin", "destination", "departDate", "returnDate", "adults", "cabin"]
        : ["cityCode", "checkIn", "checkOut", "adults", "rooms"];

    for (const key of fields) {
      const value = String(form.get(key) ?? "").trim();
      if (value) params.set(key, value);
    }
    router.push(`${tab === "flights" ? "/flights" : "/hotels"}?${params}`);
  }

  const tabs: ReadonlyArray<{ value: Tab; label: string; Icon: typeof Plane }> = [
    { value: "flights", label: tHome("searchTabs.flights"), Icon: Plane },
    { value: "hotels", label: tHome("searchTabs.hotels"), Icon: Building2 },
  ];

  return (
    <Card className="overflow-hidden shadow-lg">
      <div role="tablist" aria-label={tHome("eyebrow")} className="flex border-b border-line">
        {tabs.map(({ value, label, Icon }) => (
          <button
            key={value}
            role="tab"
            type="button"
            id={`${id}-tab-${value}`}
            aria-selected={tab === value}
            aria-controls={`${id}-panel-${value}`}
            onClick={() => setTab(value)}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 px-4 py-3.5 text-sm font-medium transition-colors sm:flex-none sm:px-6",
              tab === value
                ? "border-b-2 border-brand text-fg"
                : "border-b-2 border-transparent text-fg-muted hover:text-fg",
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>

      <form
        role="tabpanel"
        id={`${id}-panel-${tab}`}
        aria-labelledby={`${id}-tab-${tab}`}
        className="p-5 sm:p-6"
        onSubmit={onSubmit}
      >
        {tab === "flights" ? <FlightFields idPrefix={id} /> : <HotelFields idPrefix={id} />}

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-fg-faint" />
          <Button type="submit" size="lg" className="w-full sm:w-auto">
            <Search aria-hidden="true" />
            {t("submit")}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function FlightFields({ idPrefix }: { idPrefix: string }) {
  const t = useTranslations("search");

  return (
    <div className="flex flex-col gap-4">
      <fieldset className="flex flex-wrap gap-2">
        <legend className="sr-only">{t("tripType.roundTrip")}</legend>
        {(["roundTrip", "oneWay", "multiCity"] as const).map((type, index) => (
          <label
            key={type}
            className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-line px-3 py-1.5 text-xs text-fg-muted has-checked:border-brand has-checked:bg-brand-soft has-checked:text-brand"
          >
            <input
              type="radio"
              name={`${idPrefix}-trip-type`}
              defaultChecked={index === 0}
              className="sr-only"
            />
            {t(`tripType.${type}`)}
          </label>
        ))}
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* The swap button is a grid item between the fields rather than an
            absolutely positioned overlay, which would sit on top of one of them. */}
        <div className="grid items-end gap-3 sm:col-span-2 sm:grid-cols-[1fr_auto_1fr]">
          <PlaceInput label={t("from")} name="origin" placeholder={t("fromPlaceholder")} />
          <button
            type="button"
            aria-label={t("swap")}
            disabled
            className="mb-1.5 hidden size-9 items-center justify-center rounded-full border border-line bg-surface text-fg-muted disabled:opacity-50 sm:flex"
          >
            <ArrowLeftRight className="size-3.5" aria-hidden="true" />
          </button>
          <PlaceInput label={t("to")} name="destination" placeholder={t("toPlaceholder")} />
        </div>

        <Field label={t("departDate")} htmlFor={`${idPrefix}-depart`}>
          <Input
            id={`${idPrefix}-depart`}
            name="departDate"
            type="date"
            defaultValue={defaultDepartDate()}
            required
          />
        </Field>
        <Field label={t("returnDate")} htmlFor={`${idPrefix}-return`}>
          <Input id={`${idPrefix}-return`} name="returnDate" type="date" />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("passengers")} htmlFor={`${idPrefix}-pax`}>
          <Input id={`${idPrefix}-pax`} name="adults" type="number" min={1} max={9} defaultValue={1} className="tabular" />
        </Field>
        <Field label={t("cabinClass")} htmlFor={`${idPrefix}-cabin`}>
          <Select id={`${idPrefix}-cabin`} name="cabin" defaultValue="ECONOMY">
            {(
              [
                ["ECONOMY", "economy"],
                ["PREMIUM_ECONOMY", "premiumEconomy"],
                ["BUSINESS", "business"],
                ["FIRST", "first"],
              ] as const
            ).map(([value, key]) => (
              <option key={value} value={value}>
                {t(`cabin.${key}`)}
              </option>
            ))}
          </Select>
        </Field>
      </div>
    </div>
  );
}

function HotelFields({ idPrefix }: { idPrefix: string }) {
  const t = useTranslations("search");

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className="lg:col-span-2">
        <PlaceInput
          label={t("destination")}
          name="cityCode"
          placeholder={t("destinationPlaceholder")}
        />
      </div>
      <Field label={t("checkIn")} htmlFor={`${idPrefix}-checkin`}>
        <Input
          id={`${idPrefix}-checkin`}
          name="checkIn"
          type="date"
          defaultValue={defaultDepartDate()}
          required
        />
      </Field>
      <Field label={t("checkOut")} htmlFor={`${idPrefix}-checkout`}>
        <Input
          id={`${idPrefix}-checkout`}
          name="checkOut"
          type="date"
          defaultValue={defaultCheckOutDate()}
          required
        />
      </Field>
      <Field label={t("guests")} htmlFor={`${idPrefix}-guests`}>
        <Input id={`${idPrefix}-guests`} name="adults" type="number" min={1} max={9} defaultValue={2} className="tabular" />
      </Field>
      <Field label={t("rooms")} htmlFor={`${idPrefix}-rooms`}>
        <Input id={`${idPrefix}-rooms`} name="rooms" type="number" min={1} max={5} defaultValue={1} className="tabular" />
      </Field>
    </div>
  );
}
