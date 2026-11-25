"use client";

import { useEffect, useRef } from "react";
import Link from "./SmartLink";
import { capWidths, cdnImageUrl, cdnSrcSet, isCdnEnabled } from "@/lib/cdn";
import { creditFor } from "@/lib/credit";
import styles from "./Ticker.module.css";

export type TickerItem = {
  href: string;
  title: string;
  photographer: string | null;
  image: { src: string; alt: string; width?: number; height?: number; thumb?: string };
};

type Props = {
  items: TickerItem[];
  /** Accessible name for the strip. */
  label?: string;
  /** Scroll speed in px per second. */
  speed?: number;
};

/** Rendered image height (px) at desktop / phone; keep in sync with the CSS. */
const IMAGE_HEIGHT = { desktop: 200, phone: 140 };
/** Fallback aspect (w/h) when the CMS has no recorded size. */
const FALLBACK_ASPECT = 4 / 5;
/** Images that load eagerly; the rest are lazy. */
const EAGER_COUNT = 3;

function aspectOf(image: TickerItem["image"]): number {
  const { width, height } = image;
  if (!width || !height) return FALLBACK_ASPECT;
  // Clamp extreme panoramas and slivers so no plate dominates the strip.
  return Math.min(Math.max(width / height, 0.6), 1.8);
}

/**
 * A slowly moving strip of the latest stories: cover image, title,
 * photographer. The list renders twice and the track moves by exactly
 * one copy's width, so the loop has no seam. Motion is CSS transform
 * only. It pauses on hover and focus, and stays still under
 * prefers-reduced-motion (the strip then scrolls by hand). The second
 * copy is aria-hidden and inert, so screen readers and the keyboard
 * meet each story once. Every frame has its size before the image
 * loads, so nothing shifts.
 */
export function Ticker({ items, label = "Latest stories", speed = 40 }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const copyRef = useRef<HTMLUListElement>(null);

  // Duration = one copy's width / speed, measured (it changes with the
  // phone/desktop image height).
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

  // Keyboard: the strip pauses on focus, but the focused story may have
  // moved out of view. Shift the loop so it sits near the left edge.
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

  // Server estimate until the effect measures the real width.
  const estimatedWidth = items.reduce(
    (sum, item) => sum + aspectOf(item.image) * IMAGE_HEIGHT.desktop + 32,
    0
  );

  const list = (hidden: boolean) => (
    <ul
      ref={hidden ? undefined : copyRef}
      className={styles.copy}
      aria-hidden={hidden || undefined}
      inert={hidden || undefined}
    >
      {items.map((item, i) => {
        const aspect = aspectOf(item.image);
        const { image } = item;
        const src = isCdnEnabled() ? image.src : image.thumb ?? image.src;
        const sizes = `(max-width: 767px) ${Math.round(IMAGE_HEIGHT.phone * aspect)}px, ${Math.round(IMAGE_HEIGHT.desktop * aspect)}px`;
        return (
          <li
            key={item.href}
            className={styles.item}
            style={{ "--aspect": aspect } as React.CSSProperties}
          >
            <Link href={item.href} className={styles.link} tabIndex={hidden ? -1 : undefined}>
              <span className={styles.frame}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  className={styles.image}
                  data-fade=""
                  src={cdnImageUrl(src, { width: Math.min(720, image.width ?? 720) }) ?? src}
                  srcSet={cdnSrcSet(image.src, capWidths([240, 360, 480, 720], image.width)) ?? undefined}
                  sizes={sizes}
                  alt={hidden ? "" : image.alt}
                  loading={!hidden && i < EAGER_COUNT ? "eager" : "lazy"}
                  decoding="async"
                />
              </span>
              <span className={styles.title}>{item.title}</span>
              {/* Interviews are titled with the name: say it once. */}
              {creditFor(item.title, item.photographer) && (
                <span className={styles.photographer}>{item.photographer}</span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );

  return (
    <section className={styles.ticker} aria-label={label} onFocus={onFocus}>
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
