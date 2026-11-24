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

// Reveal transition inside a fixed frame. The current slide slides
// fully out over the next one (with a soft shadow on its trailing
// edge); the next slide waits underneath, slightly zoomed and offset,
// and settles forward into place. No opacity, so the page background
// never shows through. 1 = next, -1 = prev.
// Expo curves: slow start, fast middle, hard settle.
const EASE_OUT: [number, number, number, number] = [0.05, 0.9, 0.1, 1];
const EASE_IN_OUT: [number, number, number, number] = [0.87, 0, 0.13, 1];

const slideVariants: Variants = {
  enter: (direction: number) => ({
    x: direction > 0 ? "28%" : "-28%",
    scale: 1.14,
    zIndex: 1,
    boxShadow: "0 0 0 rgba(0,0,0,0)",
  }),
  active: {
    x: "0%",
    scale: 1,
    zIndex: 1,
    boxShadow: "0 0 0 rgba(0,0,0,0)",
    transition: { duration: 1.3, ease: EASE_OUT, delay: 0.06 },
  },
  exit: (direction: number) => ({
    x: direction > 0 ? "-100%" : "100%",
    scale: 1,
    zIndex: 2,
    boxShadow: direction > 0 ? "40px 0 80px rgba(0,0,0,0.45)" : "-40px 0 80px rgba(0,0,0,0.45)",
    transition: { duration: 0.9, ease: EASE_IN_OUT },
  }),
};

const instant: Variants = {
  enter: { x: 0, scale: 1, zIndex: 1 },
  active: { x: 0, scale: 1, zIndex: 1, transition: { duration: 0 } },
  exit: { x: 0, zIndex: 0, transition: { duration: 0 } },
};

/**
 * Rotates through up to three homepage hero slides:
 *   1. Latest piece (whatever content type was just published)
 *   2. From the archive (a piece >2 years old)
 *   3. Staff pick (editor-flagged)
 *
 * The carousel owns the rounded frame; each slide is a HomepageHero in
 * fill mode that moves inside it. The chip label tells the visitor why
 * this slide is here. Auto-advances on a timer, pauses
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

  // Preload every slide's image so the one underneath is ready before
  // it's revealed.
  useEffect(() => {
    for (const s of slides) {
      if (s.backgroundImage?.src) {
        const img = new Image();
        img.decoding = "async";
        img.src = s.backgroundImage.src;
      }
    }
  }, [slides]);

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
      <div className={styles.frame}>
      <AnimatePresence initial={false} custom={direction}>
        <motion.div
          key={activeKey}
          custom={direction}
          variants={reducedMotion ? instant : slideVariants}
          initial="enter"
          animate="active"
          exit="exit"
          className={styles.slide}
        >
          <HomepageHero {...activeHeroProps} fill priority={index === 0} />
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
    </div>
  );
}
