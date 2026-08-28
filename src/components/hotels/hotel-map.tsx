"use client";

import { useEffect, useRef, useState } from "react";
import {
  LngLatBounds,
  Map as MapLibreMap,
  Marker,
  NavigationControl,
} from "maplibre-gl";
import { MapPinOff } from "lucide-react";
import type { PublicHotelOffer } from "@/server/suppliers/types";
import { mapStyle } from "./map-style";
import "maplibre-gl/dist/maplibre-gl.css";

/**
 * The map half of the dual view — section 4.3.
 *
 * Markers are plain DOM elements rather than canvas symbols so they can carry
 * the price, be focused with the keyboard, and be styled with the same tokens
 * as the rest of the page.
 */
export function HotelMap({
  hotels,
  activeId,
  onSelect,
}: {
  hotels: PublicHotelOffer[];
  activeId: string | null;
  onSelect: (hotelId: string) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const markers = useRef<Map<string, Marker>>(new Map());
  const [tilesFailed, setTilesFailed] = useState(false);

  const located = hotels.filter((hotel) => hotel.coordinates !== null);

  useEffect(() => {
    if (!container.current || map.current) return;

    const instance = new MapLibreMap({
      container: container.current,
      style: mapStyle(),
      center: [55.27, 25.2],
      zoom: 11,
      attributionControl: { compact: true },
    });
    instance.addControl(new NavigationControl({ showCompass: false }), "top-right");

    // Tiles can fail on a blocked network or an exhausted tile quota. Without
    // this the map is a silent grey rectangle and the pins float on nothing,
    // which reads as a broken page rather than a missing basemap.
    instance.on("error", (event) => {
      const message = event.error?.message ?? "";
      if (/fetch|network|load/i.test(message)) setTilesFailed(true);
    });

    map.current = instance;

    return () => {
      instance.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    const instance = map.current;
    if (!instance || located.length === 0) return;

    for (const marker of markers.current.values()) marker.remove();
    markers.current.clear();

    const bounds = new LngLatBounds();

    for (const hotel of located) {
      const { latitude, longitude } = hotel.coordinates!;
      const element = document.createElement("button");
      element.type = "button";
      element.className = "hotel-pin";
      element.dataset.hotelId = hotel.hotelId;
      element.textContent = `${hotel.fromPrice.currency} ${Math.round(Number(hotel.fromPrice.amount))}`;
      element.setAttribute("aria-label", `${hotel.name}, from ${hotel.fromPrice.amount}`);
      element.addEventListener("click", () => onSelect(hotel.hotelId));

      markers.current.set(
        hotel.hotelId,
        new Marker({ element }).setLngLat([longitude, latitude]).addTo(instance),
      );
      bounds.extend([longitude, latitude]);
    }

    if (!bounds.isEmpty()) instance.fitBounds(bounds, { padding: 56, maxZoom: 14 });
  }, [located, onSelect]);

  // Selection is reflected by toggling a class rather than rebuilding markers,
  // which would drop the map's own hover and focus state on every hover.
  useEffect(() => {
    for (const [hotelId, marker] of markers.current) {
      marker.getElement().classList.toggle("hotel-pin--active", hotelId === activeId);
    }
  }, [activeId]);

  return (
    <div className="relative h-[26rem] w-full overflow-hidden rounded-card border border-line lg:h-[calc(100vh-9rem)]">
      <div
        ref={container}
        role="application"
        aria-label="Map of hotel locations"
        className="size-full"
      />

      {tilesFailed && (
        <div
          role="status"
          className="pointer-events-none absolute inset-x-3 top-3 flex items-start gap-2.5 rounded-md border border-line bg-surface/95 px-3.5 py-3 text-sm shadow-md backdrop-blur"
        >
          <MapPinOff className="mt-0.5 size-4 shrink-0 text-fg-faint" aria-hidden="true" />
          <span className="text-fg-muted">
            The map background could not load. Hotel positions are still accurate, and the
            list is unaffected.
          </span>
        </div>
      )}
    </div>
  );
}
