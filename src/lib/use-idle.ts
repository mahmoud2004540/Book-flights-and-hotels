"use client";

import { useEffect, useState } from "react";

/**
 * True once the page has finished loading and the main thread is free.
 *
 * The map engine is roughly 245KB and a second of parsing. Downloading it
 * before the list beside it is usable spends the visitor's first second on the
 * secondary half of the page, which is the wrong way round on a slow
 * connection — so it waits for `load`, then for the first idle moment after it.
 *
 * The timeout is a floor, not a target: if the thread never goes idle the
 * callback still fires, so a busy page cannot strand the map forever. Where
 * requestIdleCallback is missing (Safari) a short timer stands in for it.
 */
export function useIdle(timeoutMs = 2000): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let idleHandle: number | undefined;
    let timer: number | undefined;

    function whenIdle() {
      if (cancelled) return;
      if (typeof window.requestIdleCallback === "function") {
        idleHandle = window.requestIdleCallback(() => setReady(true), { timeout: timeoutMs });
      } else {
        timer = window.setTimeout(() => setReady(true), 300);
      }
    }

    // A page restored from the back/forward cache has already fired load.
    if (document.readyState === "complete") whenIdle();
    else window.addEventListener("load", whenIdle, { once: true });

    return () => {
      cancelled = true;
      window.removeEventListener("load", whenIdle);
      if (idleHandle !== undefined) window.cancelIdleCallback(idleHandle);
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [timeoutMs]);

  return ready;
}
