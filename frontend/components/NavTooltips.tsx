"use client";

import { useEffect, useRef } from "react";
import styles from "./NavTooltips.module.css";

/**
 * One terse line per destination. Applies to every text link that goes to
 * one of these paths (header, footer, section links such as "See
 * everything", the 404 links), never to cards: links that contain an
 * image are skipped. A link can override its line with data-tip="…" or
 * opt out with data-tip="". Buttons and other controls get a tip only
 * from data-tip.
 */
const TIPS: Record<string, string> = {
  "/": "The front page.",
  "/explore": "Every story. Sort by type, theme or chance.",
  "/explore?view=list": "Every story, numbered, as a list.",
  "/index": "Every story, numbered, as a list.",
  "/themes": "Stories grouped by what they're about.",
  "/photographers": "Everyone we've published, A to Z.",
  "/about": "Who we are and how this started.",
  "/shop": "Books from the journal.",
  "/submit": "Send us a photo essay.",
  "/contact": "Write to the editors.",
  "/random": "A random story from the archive.",
  "/search": "Find a story or a photographer.",
};

/** First hover waits this long, so passing over the nav doesn't flash tips. */
const SHOW_DELAY_MS = 350;
/** Moving from one link to the next within this window swaps instantly. */
const WARM_MS = 500;
/** Covers the gap when the pointer crosses from one link to its neighbour. */
const HIDE_GRACE_MS = 80;
/** Offset from the cursor tip, so the label sits beside the arrow, not under it. */
const CURSOR_X = 14;
const CURSOR_Y = 20;
const FOCUS_GAP = 10;
const EDGE = 8;

function tipFor(el: HTMLElement): string | null {
  if (el.hasAttribute("data-tip")) return el.getAttribute("data-tip") || null;
  if (!(el instanceof HTMLAnchorElement)) return null;
  if (el.querySelector("img, picture, video")) return null; // cards
  const url = new URL(el.href, location.href);
  if (url.origin !== location.origin) return null;
  return TIPS[url.pathname + url.search] ?? TIPS[url.pathname] ?? null;
}

/**
 * Shared tooltip layer. With a mouse it follows the cursor and swaps its
 * text as the pointer moves from one link to the next. The first tip
 * waits a beat; after that, neighbouring links answer at once. Keyboard
 * focus shows it under the focused control. Escape, click and scroll
 * dismiss it. Touch never triggers it. The target gets aria-describedby
 * while the tip is up.
 */
export function NavTooltips() {
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const tip = box.current;
    if (!tip) return;

    let current: HTMLElement | null = null; // element the tip belongs to
    let dismissed: HTMLElement | null = null; // Escape'd until the pointer leaves it
    let visible = false;
    let lastHidden = 0;
    let px = 0;
    let py = 0;
    let frame = 0;
    let showTimer = 0;
    let hideTimer = 0;

    const clearTimers = () => {
      window.clearTimeout(showTimer);
      window.clearTimeout(hideTimer);
    };

    const placeAt = (x: number, y: number, follow: boolean) => {
      const w = tip.offsetWidth;
      const h = tip.offsetHeight;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      let left = follow ? x + CURSOR_X : x;
      let top = follow ? y + CURSOR_Y : y;
      if (left + w > vw - EDGE) left = follow ? x - CURSOR_X - w : vw - w - EDGE;
      if (top + h > vh - EDGE) top = follow ? y - 12 - h : y - h;
      left = Math.max(EDGE, left);
      top = Math.max(EDGE, top);
      tip.style.transform = `translate3d(${Math.round(left)}px, ${Math.round(top)}px, 0)`;
    };

    const describe = (el: HTMLElement | null) => {
      if (current && current !== el) current.removeAttribute("aria-describedby");
      current = el;
      el?.setAttribute("aria-describedby", "nav-tooltip");
    };

    const showText = (text: string) => {
      tip.textContent = text;
      tip.setAttribute("data-on", "");
      visible = true;
    };

    const hide = () => {
      clearTimers();
      if (visible) lastHidden = performance.now();
      visible = false;
      tip.removeAttribute("data-on");
      describe(null);
    };

    // Links by destination, plus any control that carries its own
    // data-tip (icon buttons such as Grid / List).
    const targetFrom = (e: Event) =>
      (e.target as Element | null)?.closest?.("a[href], [data-tip]") as HTMLElement | null;

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      px = e.clientX;
      py = e.clientY;
      if (!visible || frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (visible) placeAt(px, py, true);
      });
    };

    const onOver = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const el = targetFrom(e);
      if (!el || el === current || el === dismissed) return;
      const text = tipFor(el);
      if (!text) return;
      px = e.clientX;
      py = e.clientY;
      clearTimers();
      describe(el);
      const warm = visible || performance.now() - lastHidden < WARM_MS;
      if (warm) {
        showText(text);
        placeAt(px, py, true);
      } else {
        showTimer = window.setTimeout(() => {
          if (current !== el) return;
          showText(text);
          placeAt(px, py, true);
        }, SHOW_DELAY_MS);
      }
    };

    const onOut = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const to = e.relatedTarget as Node | null;
      if (dismissed && !(to && dismissed.contains(to))) dismissed = null;
      if (!current || (to && current.contains(to))) return;
      // If the pointer lands on another link, onOver cancels this and
      // swaps the text in place.
      window.clearTimeout(showTimer);
      window.clearTimeout(hideTimer);
      hideTimer = window.setTimeout(hide, HIDE_GRACE_MS);
    };

    const onFocus = (e: FocusEvent) => {
      const el = targetFrom(e);
      if (!el || !el.matches(":focus-visible")) return;
      const text = tipFor(el);
      if (!text) return;
      clearTimers();
      describe(el);
      showText(text);
      const r = el.getBoundingClientRect();
      const below = r.bottom + FOCUS_GAP + tip.offsetHeight <= window.innerHeight - EDGE;
      placeAt(r.left, below ? r.bottom + FOCUS_GAP : r.top - FOCUS_GAP, false);
    };

    const onBlur = (e: FocusEvent) => {
      if (current && e.target === current) hide();
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || !current) return;
      dismissed = current;
      hide();
    };

    const onScroll = () => {
      if (current) hide();
    };

    document.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerover", onOver);
    document.addEventListener("pointerout", onOut);
    document.addEventListener("focusin", onFocus);
    document.addEventListener("focusout", onBlur);
    document.addEventListener("keydown", onKey);
    document.addEventListener("click", hide, true);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      clearTimers();
      cancelAnimationFrame(frame);
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerover", onOver);
      document.removeEventListener("pointerout", onOut);
      document.removeEventListener("focusin", onFocus);
      document.removeEventListener("focusout", onBlur);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("click", hide, true);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  // Text and position are set directly on the node, so following the
  // cursor never re-renders React.
  return <div ref={box} id="nav-tooltip" role="tooltip" className={styles.tip} />;
}
