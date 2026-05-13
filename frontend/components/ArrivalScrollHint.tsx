"use client";

import { useEffect } from "react";

const FLAG_KEY = "tpj-arrival-scroll";

/**
 * The homepage hero and the article hero look visually identical, so
 * a click-through from the hero can leave the visitor unsure whether
 * the page actually changed. This component, mounted on article
 * templates, reads a one-shot sessionStorage flag set by HomepageHero
 * and performs a small smooth scroll once the route-curtain
 * animation clears. The scroll moves the viewport down ~35% of its
 * height — enough to nudge the article body into view as the cue,
 * not enough to skip past the hero entirely.
 *
 * Scoped to the hero only — Keep Exploring, ThemeBrowser, and Dive
 * Deeper cards don't set the flag, so they don't trigger the scroll.
 * Direct URL loads, refreshes, and back-button navigation also skip.
 * Respects prefers-reduced-motion.
 */
export function ArrivalScrollHint() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const flag = sessionStorage.getItem(FLAG_KEY);
    if (!flag) return;
    sessionStorage.removeItem(FLAG_KEY);

    const reduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Short delay so Next.js's own scroll-to-top on route change
    // happens first; we override it right after. ~120ms is fast
    // enough to feel near-instant while still winning the race.
    // Intentionally no cleanup — in React strict mode (dev) effects
    // run mount → cleanup → mount, and a clearTimeout in cleanup
    // would cancel the scroll before it fires. The flag is one-shot
    // and read-and-cleared above, so the second mount finds nothing
    // and doesn't double-schedule.
    window.setTimeout(() => {
      const targetY = Math.round(window.innerHeight * 0.35);
      window.scrollTo({
        top: targetY,
        behavior: reduced ? "auto" : "smooth",
      });
    }, 120);
  }, []);

  return null;
}

/**
 * Called from HomepageHero's onClick to arm the scroll cue on the
 * destination article page. Navigation itself proceeds as normal; the
 * destination page picks up the flag on mount and clears it.
 */
export function markArrivalScrollFromHero() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(FLAG_KEY, "1");
  } catch {
    // sessionStorage may be unavailable (private mode, quota); fail
    // silently. Worst case is the scroll cue doesn't fire.
  }
}
