"use client";

import { useEffect, useState } from "react";
import styles from "./PlateCounter.module.css";

type Props = {
  /** Number of plates in the body (hangPlates). */
  total: number;
};

const pad = (n: number) => String(n).padStart(2, "0");
const THRESHOLDS = [0, 0.1, 0.25, 0.5, 0.75, 1];

/**
 * Frame counter for essays: a small fixed "04 / 13" at the bottom left,
 * naming the plate most in view. It shows only while body photographs
 * are on screen. Decorative (aria-hidden, no pointer events): the
 * exhibition checklist already gives the structure. Desktop only, and
 * off under reduced motion (CSS hides it; the observer isn't started).
 */
export function PlateCounter({ total }: Props) {
  const [current, setCurrent] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (total < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const plates = [...document.querySelectorAll<HTMLElement>("[id^='plate-']")];
    if (plates.length === 0) return;

    // Visible share of each plate, keyed by its number.
    const ratios = new Map<number, number>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const n = Number(e.target.id.slice("plate-".length));
          if (e.isIntersecting && e.intersectionRatio > 0) ratios.set(n, e.intersectionRatio);
          else ratios.delete(n);
        }
        let best = 0;
        let bestRatio = 0;
        ratios.forEach((r, n) => {
          if (r > bestRatio) {
            best = n;
            bestRatio = r;
          }
        });
        setVisible(best > 0);
        if (best > 0) setCurrent(best);
      },
      // Ignore the sticky nav band at the top.
      { threshold: THRESHOLDS, rootMargin: "-72px 0px 0px 0px" },
    );
    plates.forEach((p) => io.observe(p));
    return () => io.disconnect();
  }, [total]);

  if (total < 2) return null;

  return (
    <p
      className={styles.counter}
      data-visible={visible && current > 0 ? "" : undefined}
      aria-hidden="true"
    >
      {pad(Math.max(1, current))} / {pad(total)}
    </p>
  );
}
