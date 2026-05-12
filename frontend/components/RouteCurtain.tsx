"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import styles from "./RouteCurtain.module.css";

// Fixed sequence — same camera shows first on every navigation so the
// transition reads as a deterministic, designed motif rather than
// random noise. The cycle wraps if a navigation takes long enough.
const CAMERA_FRAMES = [
  "/svg/cameras/camera-1.svg",
  "/svg/cameras/camera-2.svg",
  "/svg/cameras/camera-3.svg",
  "/svg/cameras/camera-4.svg",
  "/svg/cameras/camera-5.svg",
  "/svg/cameras/camera-6.svg",
];

// One frame every 150ms = ~900ms full cycle. The curtain's camera-
// visible window is ~715ms (panel center crosses the viewport between
// 17.5% and 82.5% of the 1100ms animation), so the user sees 4-5
// distinct cameras per navigation.
const FRAME_MS = 150;

/**
 * Route transition: a dark panel sweeps down from the top, holds briefly
 * with a centered cycling-camera mark visible, then continues off the
 * bottom to reveal the new page.
 *
 * Hooks into a document-level click listener that catches internal
 * <a> targets, prevents default navigation, runs the cover phase, then
 * pushes the route under the panel and lets the uncover phase finish.
 * Skips for:
 *   - non-left-clicks and clicks with modifier keys (open-in-new-tab)
 *   - links with target="_blank" or a download attribute
 *   - hash, mailto:, tel: links
 *   - cross-origin links
 *   - users with prefers-reduced-motion (navigation happens normally)
 *
 * Browser back/forward and direct URL entry don't fire a click, so they
 * skip the curtain. That's intentional — those navigations feel "user-
 * initiated immediate" and don't need the editorial interlude.
 */
export function RouteCurtain() {
  const router = useRouter();
  const [active, setActive] = useState(false);
  const [frameIndex, setFrameIndex] = useState(0);
  const timeoutsRef = useRef<number[]>([]);

  // Camera cycle: starts when the curtain activates, stops when it
  // returns to idle. Each frame holds for FRAME_MS, then advances.
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => {
      setFrameIndex((i) => (i + 1) % CAMERA_FRAMES.length);
    }, FRAME_MS);
    return () => window.clearInterval(id);
  }, [active]);

  useEffect(() => {
    function clearPending() {
      for (const id of timeoutsRef.current) window.clearTimeout(id);
      timeoutsRef.current = [];
    }

    function handleClick(e: MouseEvent) {
      if (e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (e.defaultPrevented) return;

      const target = e.target as HTMLElement | null;
      const link = target?.closest("a");
      if (!link) return;

      const href = link.getAttribute("href");
      if (!href) return;
      if (href.startsWith("#")) return;
      if (href.startsWith("mailto:") || href.startsWith("tel:")) return;
      if (link.target === "_blank") return;
      if (link.hasAttribute("download")) return;

      // Cross-origin check: only intercept same-origin internal navs.
      try {
        const url = new URL(href, window.location.href);
        if (url.origin !== window.location.origin) return;
        // Same path + same hash = no navigation happening anyway.
        if (
          url.pathname === window.location.pathname &&
          url.search === window.location.search
        ) {
          return;
        }
      } catch {
        return;
      }

      // Respect the user's motion preference: don't intercept; let the
      // Link navigate normally.
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        return;
      }

      e.preventDefault();
      clearPending();
      // Reset to camera 1 so every navigation begins the cycle at the
      // same starting point.
      setFrameIndex(0);
      setActive(true);

      // Phase timings (must stay in sync with the @keyframes in
      // RouteCurtain.module.css):
      //   0       -> panel starts above the viewport
      //   35%     -> fully covering (camera visible)
      //   65%     -> still covering (held)
      //   100%    -> panel has left the bottom
      // Total animation: 1100ms.
      //
      // We push the route at ~330ms (right around the moment the panel
      // hits cover) so the new page is mounted under the curtain by
      // the time the uncover phase reveals it.
      const total = 1100;
      const navAt = 330;

      timeoutsRef.current.push(
        window.setTimeout(() => {
          router.push(href);
        }, navAt),
        window.setTimeout(() => {
          setActive(false);
        }, total)
      );
    }

    document.addEventListener("click", handleClick);
    return () => {
      document.removeEventListener("click", handleClick);
      clearPending();
    };
  }, [router]);

  return (
    <div
      className={`${styles.curtain}${active ? " " + styles.curtainActive : ""}`}
      aria-hidden="true"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className={styles.logo}
        src={CAMERA_FRAMES[frameIndex]}
        alt=""
      />
      {/* Preload remaining frames so the first cycle doesn't pop. The
          hidden images warm the browser's image cache without taking
          layout space. */}
      <div style={{ display: "none" }} aria-hidden="true">
        {CAMERA_FRAMES.map((src) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={src} src={src} alt="" />
        ))}
      </div>
    </div>
  );
}
