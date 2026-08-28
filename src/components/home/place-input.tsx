"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Field, Input } from "@/components/ui/field";

type Place = { code: string; name: string; cityName: string | null; countryCode: string | null };

/**
 * Airport lookup with a 300ms debounce — section 7.
 *
 * The debounce is the difference between one request per search and one per
 * keystroke, which would exhaust the supplier quota on a single visitor.
 */
export function PlaceInput({
  label,
  name,
  placeholder,
  defaultValue = "",
}: {
  label: string;
  name: string;
  placeholder: string;
  defaultValue?: string;
}) {
  const id = useId();
  const [query, setQuery] = useState(defaultValue);
  const [places, setPlaces] = useState<Place[]>([]);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Whether this query is worth a lookup at all. A complete IATA code has
  // nothing left to suggest, and one character matches almost everything.
  const trimmed = query.trim();
  const shouldLookUp = trimmed.length >= 2 && !/^[A-Za-z]{3}$/.test(trimmed);

  useEffect(() => {
    if (!shouldLookUp) return;

    const controller = new AbortController();
    const timer = setTimeout(() => {
      void fetch(`/api/search/places?q=${encodeURIComponent(query)}`, {
        signal: controller.signal,
      })
        .then((response) => response.json() as Promise<{ places?: Place[] }>)
        .then((body) => setPlaces(body.places ?? []))
        .catch(() => {
          // An aborted or failed lookup leaves the field usable as free text.
        });
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, shouldLookUp]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const suggestions = shouldLookUp ? places : [];

  function choose(place: Place) {
    setQuery(place.code);
    setOpen(false);
  }

  return (
    <div ref={boxRef} className="relative">
      <Field label={label} htmlFor={id}>
        <Input
          id={id}
          name={name}
          value={query}
          placeholder={placeholder}
          autoComplete="off"
          role="combobox"
          aria-expanded={open && suggestions.length > 0}
          aria-controls={`${id}-list`}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          required
        />
      </Field>

      {open && suggestions.length > 0 && (
        <ul
          id={`${id}-list`}
          role="listbox"
          className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border border-line bg-surface shadow-lg"
        >
          {suggestions.map((place) => (
            <li key={place.code} role="option" aria-selected={false}>
              <button
                type="button"
                onClick={() => choose(place)}
                className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-surface-2"
              >
                <span className="font-mono text-xs font-semibold text-brand">{place.code}</span>
                <span className="min-w-0 flex-1 truncate">
                  {place.cityName ?? place.name}
                  <span className="ms-1.5 text-xs text-fg-faint">{place.name}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
