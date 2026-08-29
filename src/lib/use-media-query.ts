"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Whether a media query matches right now.
 *
 * useSyncExternalStore rather than an effect: the browser already holds this
 * state, so subscribing to it is honest, and React's compiler rules rightly
 * refuse a setState in an effect that mirrors something the platform owns.
 *
 * The server snapshot is false. That is the safe default here — it means the
 * first render assumes the narrow layout and never mounts a desktop-only
 * widget during hydration.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query],
  );

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}
