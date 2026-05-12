"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  children: React.ReactNode;
  /** Pass through to the wrapping div so callers keep their grid styles. */
  className?: string;
  /**
   * Delay (ms) between each child's animation start. Default 100ms. Smaller
   * = faster cascade; larger = more deliberate.
   */
  step?: number;
};

/**
 * Wraps a row/grid of items and reveals them one-by-one as soon as the
 * wrapper enters the viewport. Above-the-fold sections trigger
 * immediately on mount; below-the-fold sections trigger when scrolled
 * into view. Each child gets an animation-delay via :nth-child rules
 * in globals.css (.stagger-revealed > *:nth-child(N)).
 *
 * SSR caveat: children render with opacity 0 until JS hydrates and the
 * .stagger-revealed class is applied. The cards are still in the DOM
 * for crawlers and screen readers; only the visual state is delayed.
 */
export function StaggerReveal({ children, className, step = 100 }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;

    // Above-the-fold: skip the observer round-trip and reveal next tick.
    // The next-tick defer is intentional — it lets the class be added
    // after the initial paint so the animation runs visibly instead of
    // being skipped because the elements are already at their final
    // state by the time the browser commits.
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      const id = requestAnimationFrame(() => setRevealed(true));
      return () => cancelAnimationFrame(id);
    }

    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setRevealed(true);
            obs.disconnect();
            return;
          }
        }
      },
      // 5% threshold means as soon as a sliver enters the viewport.
      // The -10% bottom rootMargin holds back the trigger slightly so
      // sections begin revealing just before they're fully on-screen.
      { threshold: 0.05, rootMargin: "0px 0px -10% 0px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`${className ?? ""} stagger-children${revealed ? " stagger-revealed" : ""}`}
      style={{ "--stagger-step": `${step}ms` } as React.CSSProperties}
    >
      {children}
    </div>
  );
}
