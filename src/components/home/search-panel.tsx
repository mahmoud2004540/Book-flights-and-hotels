"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeftRight, Building2, Plane, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { cn } from "@/lib/utils";

type Tab = "flights" | "hotels";

/**
 * The search box shell — section 4.1.
 * Fields, keyboard navigation and copy all work here.
 * Wiring it to live search (autocomplete and results) is stages 2 and 3.
 */
export function SearchPanel() {
  const t = useTranslations("search");
  const tHome = useTranslations("home");
  const tStatus = useTranslations("status");
  const [tab, setTab] = useState<Tab>("flights");
  const id = useId();

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

      <div
        role="tabpanel"
        id={`${id}-panel-${tab}`}
        aria-labelledby={`${id}-tab-${tab}`}
        className="p-5 sm:p-6"
      >
        {tab === "flights" ? <FlightFields idPrefix={id} /> : <HotelFields idPrefix={id} />}

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-fg-faint">{tStatus("stageNotice")}</p>
          <Button size="lg" disabled className="w-full sm:w-auto">
            <Search aria-hidden="true" />
            {t("submit")}
          </Button>
        </div>
      </div>
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
          <Field label={t("from")} htmlFor={`${idPrefix}-from`}>
            <Input id={`${idPrefix}-from`} placeholder={t("fromPlaceholder")} disabled />
          </Field>
          <button
            type="button"
            aria-label={t("swap")}
            disabled
            className="mb-1.5 hidden size-9 items-center justify-center rounded-full border border-line bg-surface text-fg-muted disabled:opacity-50 sm:flex"
          >
            <ArrowLeftRight className="size-3.5" aria-hidden="true" />
          </button>
          <Field label={t("to")} htmlFor={`${idPrefix}-to`}>
            <Input id={`${idPrefix}-to`} placeholder={t("toPlaceholder")} disabled />
          </Field>
        </div>

        <Field label={t("departDate")} htmlFor={`${idPrefix}-depart`}>
          <Input id={`${idPrefix}-depart`} type="date" disabled />
        </Field>
        <Field label={t("returnDate")} htmlFor={`${idPrefix}-return`}>
          <Input id={`${idPrefix}-return`} type="date" disabled />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("passengers")} htmlFor={`${idPrefix}-pax`}>
          <Input id={`${idPrefix}-pax`} type="number" min={1} defaultValue={1} disabled className="tabular" />
        </Field>
        <Field label={t("cabinClass")} htmlFor={`${idPrefix}-cabin`}>
          <Select id={`${idPrefix}-cabin`} disabled>
            {(["economy", "premiumEconomy", "business", "first"] as const).map((c) => (
              <option key={c} value={c}>
                {t(`cabin.${c}`)}
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
      <Field label={t("destination")} htmlFor={`${idPrefix}-dest`} className="lg:col-span-2">
        <Input id={`${idPrefix}-dest`} placeholder={t("destinationPlaceholder")} disabled />
      </Field>
      <Field label={t("checkIn")} htmlFor={`${idPrefix}-checkin`}>
        <Input id={`${idPrefix}-checkin`} type="date" disabled />
      </Field>
      <Field label={t("checkOut")} htmlFor={`${idPrefix}-checkout`}>
        <Input id={`${idPrefix}-checkout`} type="date" disabled />
      </Field>
      <Field label={t("guests")} htmlFor={`${idPrefix}-guests`}>
        <Input id={`${idPrefix}-guests`} type="number" min={1} defaultValue={2} disabled className="tabular" />
      </Field>
    </div>
  );
}
