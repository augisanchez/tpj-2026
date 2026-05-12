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

// One frame every 150ms.
const FRAME_MS = 150;

// Top-level destinations get the curtain. Content pages (essays,
// interviews, features, individual photographers, individual themes)
// navigate without it and get a lighter inline fade-up via
// PageTransition. Hierarchy avoids transition fatigue: the curtain
// is reserved for the moments that actually feel like a section
// change.
const TOP_LEVEL_PATHS = new Set<string>([
  "/",
  "/explore",
  "/themes",
  "/photographers",
  "/about",
  "/shop",
  "/submit",
  "/search",
  "/contact",
]);

function isTopLevelDestination(href: string): boolean {
  try {
    const url = new URL(href, window.location.href);
    return TOP_LEVEL_PATHS.has(url.pathname);
  } catch {
    return false;
  }
}

/**
 * Route transition: a white panel fades in over the page, holds briefly
 * with the cycling camera silhouettes above the TPJ wordmark, then
 * fades back out to reveal the new page. Pure opacity motion (no
 * translation) plus a weighted ease-in-out reads as deliberate
 * without feeling clunky.
 *
 * Hooks into a document-level click listener (capture phase) that
 * catches internal <a> targets, prevents default navigation, runs
 * the fade-in phase, pushes the route under the panel, then lets
 * the fade-out phase finish.
 *
 * Skips for:
 *   - non-left-clicks and clicks with modifier keys (open-in-new-tab)
 *   - links with target="_blank" or a download attribute
 *   - hash, mailto:, tel: links
 *   - cross-origin links
 *   - users with prefers-reduced-motion (navigation happens normally)
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
      // We intentionally don't bail on e.defaultPrevented here: we run
      // in capture phase before anything else gets the click, so this
      // would always be false at our point unless another capture-phase
      // listener stepped in.

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
        if (
          url.pathname === window.location.pathname &&
          url.search === window.location.search
        ) {
          return;
        }
      } catch {
        return;
      }

      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        return;
      }

      // Hierarchy: only intercept top-level destinations. Content
      // clicks (essays/interviews/features/individual photographer
      // or theme pages) get a lighter inline reveal via
      // PageTransition instead, so we don't pay the curtain cost
      // every time the editor drills into a single piece.
      if (!isTopLevelDestination(href)) {
        return;
      }

      // Capture-phase intercept: stop the click before Next.js Link's
      // own onClick (which would call router.push and navigate
      // instantly) ever runs. We take over the navigation ourselves
      // via the timeout below.
      e.preventDefault();
      e.stopPropagation();
      clearPending();
      // Reset to camera 1 so every navigation begins the cycle at the
      // same starting point.
      setFrameIndex(0);
      setActive(true);

      // Phase timings (must stay in sync with the @keyframes in
      // RouteCurtain.module.css):
      //   0       -> transparent
      //   27%     -> fully opaque (350ms in)
      //   73%     -> still fully opaque (held — user feedback was the
      //              hold was too short before the next item revealed)
      //   100%    -> transparent again (new page revealed)
      // Total: 1300ms (up from 1100ms). Hold is ~600ms.
      //
      // router.push at ~380ms (right after fade-in completes) so the
      // new page is mounted behind the curtain during the hold.
      const total = 1300;
      const navAt = 380;

      timeoutsRef.current.push(
        window.setTimeout(() => {
          router.push(href);
        }, navAt),
        window.setTimeout(() => {
          setActive(false);
        }, total)
      );
    }

    document.addEventListener("click", handleClick, true);
    return () => {
      document.removeEventListener("click", handleClick, true);
      clearPending();
    };
  }, [router]);

  return (
    <div
      className={`${styles.curtain}${active ? " " + styles.curtainActive : ""}`}
      aria-hidden="true"
    >
      <div className={styles.stack}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className={styles.camera}
          src={CAMERA_FRAMES[frameIndex]}
          alt=""
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className={styles.wordmark}
          src="/svg/wordmark.svg"
          alt=""
        />
      </div>

      {/* Preload all camera frames on mount so the first cycle doesn't
          pop in with a delay. The hidden div doesn't take layout space. */}
      <div style={{ display: "none" }} aria-hidden="true">
        {CAMERA_FRAMES.map((src) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={src} src={src} alt="" />
        ))}
      </div>
    </div>
  );
}
