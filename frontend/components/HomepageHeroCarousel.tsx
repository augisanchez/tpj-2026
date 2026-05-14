"use client";

import { useEffect, useState } from "react";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type Variants,
} from "motion/react";
import { useDrag } from "@use-gesture/react";
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
const SWIPE_DISTANCE = 60;
const SWIPE_VELOCITY = 0.3;

// Direction-aware slide variants: incoming slide flies in from the
// side matching the navigation direction, outgoing slide flies away
// to the opposite side. 1 = next, -1 = prev. Subtle 36px translate
// keeps the motion editorial rather than aggressive.
const slideVariants: Variants = {
  enter: (direction: number) => ({
    opacity: 0,
    x: direction > 0 ? 36 : -36,
  }),
  active: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.55, ease: [0.2, 0.6, 0.2, 1] },
  },
  exit: (direction: number) => ({
    opacity: 0,
    x: direction > 0 ? -36 : 36,
    transition: { duration: 0.35, ease: [0.4, 0, 1, 1] },
  }),
};

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
  // Direction sign that the AnimatePresence variants use to decide
  // which side to slide in/out from. +1 next, -1 prev. Reset on
  // every transition end via the AnimatePresence onExitComplete.
  const [direction, setDirection] = useState(1);
  const [paused, setPaused] = useState(false);

  const advance = (delta: number) => {
    setDirection(delta > 0 ? 1 : -1);
    setIndex((i) => (i + delta + slides.length) % slides.length);
  };

  const goTo = (next: number) => {
    setDirection(next > index ? 1 : -1);
    setIndex(next);
  };

  useEffect(() => {
    if (slides.length <= 1) return;
    if (reducedMotion) return;
    if (paused) return;
    const id = window.setInterval(() => {
      setDirection(1);
      setIndex((i) => (i + 1) % slides.length);
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [slides.length, intervalMs, paused, reducedMotion]);

  // Swipe gestures for touch + pointer drag. Crossing 60px of drag
  // distance OR 0.3 velocity in either direction advances. Vertical
  // movement is ignored so vertical page scroll still works inside
  // the carousel surface.
  const bindDrag = useDrag(
    ({ last, movement: [mx], velocity: [vx], direction: [dx] }) => {
      if (!last) return;
      if (slides.length <= 1) return;
      const distance = Math.abs(mx);
      const speed = Math.abs(vx);
      if (distance < SWIPE_DISTANCE && speed < SWIPE_VELOCITY) return;
      const dir = dx < 0 ? 1 : -1; // swipe left → next
      advance(dir);
    },
    {
      axis: "x",
      filterTaps: true,
      pointer: { touch: true },
    }
  );

  if (slides.length === 0) return null;
  if (slides.length === 1) {
    const { key: _k, ...heroProps } = slides[0];
    return <HomepageHero {...heroProps} />;
  }

  const { key: activeKey, ...activeHeroProps } = slides[index];

  return (
    <div
      className={styles.carousel}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      {...bindDrag()}
      style={{ touchAction: "pan-y" }}
    >
      <AnimatePresence mode="wait" initial={false} custom={direction}>
        <motion.div
          key={activeKey}
          custom={direction}
          variants={slideVariants}
          initial="enter"
          animate="active"
          exit="exit"
          className={styles.slide}
        >
          <HomepageHero {...activeHeroProps} />
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
              onClick={() => goTo(i)}
            />
          );
        })}
      </div>
    </div>
  );
}
