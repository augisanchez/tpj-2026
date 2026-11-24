"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import styles from "./Ticker.module.css";

export type TickerItem = {
  href: string;
  title: string;
  photographer: string | null;
};

type Props = {
  items: TickerItem[];
  /** "loud": accent band. "quiet": text on page background, hairlines. */
  variant?: "loud" | "quiet";
  /** Typeface for the loud band. Quiet is always Inter. */
  font?: "display" | "ui";
  /** Value for `data-accent` (0..4) on the loud band. */
  accent?: string;
  /** Scroll speed in px per second. */
  speed?: number;
};

/**
 * "Now / Next" band: one line of caps listing the latest stories,
 * scrolling slowly leftward. The list is rendered twice and the track
 * moves by exactly one copy's width, so the loop has no seam. Motion is
 * CSS transform only. It pauses on hover and focus, and stays still
 * under prefers-reduced-motion. The second copy is aria-hidden and
 * inert, so screen readers and the keyboard meet each story once.
 */
export function Ticker({
  items,
  variant = "loud",
  font = "display",
  accent,
  speed = 50,
}: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const copyRef = useRef<HTMLUListElement>(null);

  // Duration = one copy's width / speed. The server render uses a
  // character-count estimate; this replaces it with the measured width.
  useEffect(() => {
    const track = trackRef.current;
    const copy = copyRef.current;
    if (!track || !copy) return;
    const apply = () => {
      const width = copy.getBoundingClientRect().width;
      if (width > 0) {
        track.style.setProperty("--ticker-duration", `${(width / speed).toFixed(2)}s`);
      }
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(copy);
    return () => ro.disconnect();
  }, [speed, items]);

  // Keyboard: the band pauses on focus, but the focused story may have
  // scrolled out of view. Move the loop so it sits at the left edge.
  const onFocus = (event: React.FocusEvent<HTMLElement>) => {
    const track = trackRef.current;
    const copy = copyRef.current;
    const item = (event.target as HTMLElement).closest("li");
    if (!track || !copy || !item || !copy.contains(item)) return;
    const anim = track.getAnimations()[0];
    const duration = Number(anim?.effect?.getComputedTiming().duration);
    if (!anim || !duration) return;
    const width = copy.getBoundingClientRect().width;
    const offset = Math.max(0, item.offsetLeft - 16);
    anim.currentTime = (offset / width) * duration;
    event.currentTarget.scrollLeft = 0;
  };

  if (items.length === 0) return null;

  const estimatedWidth = items.reduce(
    (sum, item) => sum + (item.title.length + (item.photographer?.length ?? 0) + 10) * 8 + 48,
    0
  );

  const list = (hidden: boolean) => (
    <ul
      ref={hidden ? undefined : copyRef}
      className={styles.copy}
      aria-hidden={hidden || undefined}
      inert={hidden || undefined}
    >
      {items.map((item) => (
        <li key={item.href} className={styles.item}>
          <Link href={item.href} className={styles.link} tabIndex={hidden ? -1 : undefined}>
            <span className={styles.label}>New</span>
            <span className={styles.sep} aria-hidden="true">·</span>
            <span>{item.title}</span>
            {item.photographer && (
              <>
                <span className={styles.sep} aria-hidden="true">—</span>
                <span>{item.photographer}</span>
              </>
            )}
          </Link>
          <span className={styles.dot} aria-hidden="true" />
        </li>
      ))}
    </ul>
  );

  const classes = [
    styles.ticker,
    variant === "quiet" ? styles.quiet : styles.loud,
    variant === "quiet" || font === "ui" ? styles.fontUi : styles.fontDisplay,
  ].join(" ");

  return (
    <section
      className={classes}
      aria-label="Latest stories"
      data-accent={variant === "loud" ? accent : undefined}
      onFocus={onFocus}
    >
      <div
        ref={trackRef}
        className={styles.track}
        style={{ "--ticker-duration": `${Math.round(estimatedWidth / speed)}s` } as React.CSSProperties}
      >
        {list(false)}
        {list(true)}
      </div>
    </section>
  );
}
