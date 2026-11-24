"use client";

import { useEffect, useRef, useState } from "react";
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

const SHOW_DELAY_MS = 350;
const HIDE_GRACE_MS = 120;
const GAP = 10;
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
 * Shared tooltip layer. Shows after a short hover delay, at once for
 * keyboard focus, stays while the pointer moves onto it, and hides on
 * Escape, blur, scroll or leave (WCAG 1.4.13). Touch never triggers it.
 * The target gets aria-describedby while the tip is up.
 */
export function NavTooltips() {
  const [tip, setTip] = useState<{ text: string; x: number; y: number; above: boolean } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const target = useRef<HTMLElement | null>(null);
  const showTimer = useRef(0);
  const hideTimer = useRef(0);

  useEffect(() => {
    const clear = () => {
      window.clearTimeout(showTimer.current);
      window.clearTimeout(hideTimer.current);
    };
    const hide = () => {
      clear();
      target.current?.removeAttribute("aria-describedby");
      target.current = null;
      setTip(null);
    };
    const show = (el: HTMLElement, text: string) => {
      const r = el.getBoundingClientRect();
      const above = r.bottom + 48 > window.innerHeight;
      target.current?.removeAttribute("aria-describedby");
      target.current = el;
      el.setAttribute("aria-describedby", "nav-tooltip");
      setTip({ text, x: r.left + r.width / 2, y: above ? r.top - GAP : r.bottom + GAP, above });
    };
    // Links by destination, plus any control that carries its own
    // data-tip (icon buttons such as Grid / List).
    const linkFrom = (e: Event) =>
      (e.target as Element | null)?.closest?.("a[href], [data-tip]") as HTMLElement | null;

    const onOver = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      if (box.current?.contains(e.target as Node)) {
        window.clearTimeout(hideTimer.current);
        return;
      }
      const el = linkFrom(e);
      if (!el) return;
      const text = tipFor(el);
      if (!text) return;
      window.clearTimeout(hideTimer.current);
      if (target.current === el) return;
      window.clearTimeout(showTimer.current);
      showTimer.current = window.setTimeout(() => show(el, text), SHOW_DELAY_MS);
    };
    const onOut = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const to = e.relatedTarget as Node | null;
      if (to && (box.current?.contains(to) || target.current?.contains(to))) return;
      window.clearTimeout(showTimer.current);
      if (target.current) hideTimer.current = window.setTimeout(hide, HIDE_GRACE_MS);
    };
    const onFocus = (e: FocusEvent) => {
      const el = linkFrom(e);
      if (!el || !el.matches(":focus-visible")) return;
      const text = tipFor(el);
      if (text) show(el, text);
    };
    const onBlur = (e: FocusEvent) => {
      if (target.current && e.target === target.current) hide();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && target.current) hide();
    };

    document.addEventListener("pointerover", onOver);
    document.addEventListener("pointerout", onOut);
    document.addEventListener("focusin", onFocus);
    document.addEventListener("focusout", onBlur);
    document.addEventListener("keydown", onKey);
    document.addEventListener("click", hide, true);
    window.addEventListener("scroll", hide, { passive: true });
    return () => {
      clear();
      document.removeEventListener("pointerover", onOver);
      document.removeEventListener("pointerout", onOut);
      document.removeEventListener("focusin", onFocus);
      document.removeEventListener("focusout", onBlur);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("click", hide, true);
      window.removeEventListener("scroll", hide);
    };
  }, []);

  // Keep the tip inside the viewport once its width is known.
  useEffect(() => {
    const el = box.current;
    if (!el || !tip) return;
    const w = el.offsetWidth;
    const left = Math.min(Math.max(tip.x - w / 2, EDGE), window.innerWidth - w - EDGE);
    el.style.left = `${left}px`;
  }, [tip]);

  return (
    <div
      ref={box}
      id="nav-tooltip"
      role="tooltip"
      className={styles.tip}
      data-on={tip ? "" : undefined}
      data-above={tip?.above ? "" : undefined}
      style={tip ? { top: tip.y } : undefined}
    >
      {tip?.text}
    </div>
  );
}
