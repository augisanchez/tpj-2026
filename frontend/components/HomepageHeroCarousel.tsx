"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { HomepageHero } from "./HomepageHero";
import styles from "./HomepageHeroCarousel.module.css";

export type HeroSlide = {
  key: string;
  href: string;
  contentTypeLabel: string;
  title: string;
  date?: string;
  excerpt?: string;
  photographerName?: string | null;
  backgroundImage?: { src: string; alt: string };
};

type Props = {
  slides: HeroSlide[];
  /** Auto-advance interval in ms. Defaults to 7000 (7s) — long
   *  enough to read each slide, short enough to keep the page alive. */
  intervalMs?: number;
};

const DEFAULT_INTERVAL = 7000;

/**
 * Rotates through up to three homepage hero slides:
 *   1. Latest piece (whatever content type was just published)
 *   2. From the archive (a piece >2 years old)
 *   3. Staff pick (editor-flagged)
 *
 * Each slide is a full HomepageHero swap; the chip label tells the
 * visitor why this slide is here. Auto-advances on a timer, pauses
 * on hover/focus, and respects prefers-reduced-motion (renders the
 * first slide statically — no rotation).
 *
 * Single-slide input renders a plain HomepageHero with no carousel
 * chrome. Two-slide input gives two dots; three gives three.
 */
export function HomepageHeroCarousel({ slides, intervalMs = DEFAULT_INTERVAL }: Props) {
  const reducedMotion = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (slides.length <= 1) return;
    if (reducedMotion) return;
    if (paused) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % slides.length);
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [slides.length, intervalMs, paused, reducedMotion]);

  if (slides.length === 0) return null;
  if (slides.length === 1) {
    const slide = slides[0];
    return <HomepageHero {...slide} />;
  }

  const active = slides[index];

  return (
    <div
      className={styles.carousel}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={active.key}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.45, ease: [0.2, 0.6, 0.2, 1] }}
          className={styles.slide}
        >
          <HomepageHero {...active} />
        </motion.div>
      </AnimatePresence>

      <div
        className={styles.dots}
        role="tablist"
        aria-label="Featured hero rotation"
      >
        {slides.map((slide, i) => {
          const isActive = i === index;
          return (
            <button
              key={slide.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-label={`Show slide ${i + 1} of ${slides.length}: ${slide.contentTypeLabel}`}
              tabIndex={isActive ? 0 : -1}
              className={`${styles.dot}${isActive ? " " + styles.dotActive : ""}`}
              onClick={() => setIndex(i)}
            />
          );
        })}
      </div>
    </div>
  );
}
