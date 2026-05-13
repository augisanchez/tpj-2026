"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  motion,
  useMotionValue,
  animate,
  type PanInfo,
} from "motion/react";
import styles from "./ImageViewer.module.css";

// Distance + velocity thresholds for the two release outcomes.
// Crossing either threshold on the matching axis triggers the action;
// otherwise motion's spring snaps the image back to origin.
const SWIPE_CLOSE_DISTANCE = 120;
const SWIPE_CLOSE_VELOCITY = 500;
const SWIPE_NAV_DISTANCE = 80;
const SWIPE_NAV_VELOCITY = 500;

type ViewerImage = {
  src: string;
  alt: string;
  caption?: string;
};

type Props = {
  /** A ref to the article body container. The viewer scans it for <img>
   *  elements and binds clicks to open them in the fullscreen overlay. */
  containerRef: React.RefObject<HTMLElement | null>;
};

/**
 * Walks the DOM under containerRef and returns an array of viewer-ready
 * images, plus a map from each image element to its index. The map lets
 * click handlers resolve which image to open in O(1).
 */
function collectImages(
  root: HTMLElement
): { images: ViewerImage[]; map: Map<HTMLImageElement, number> } {
  const images: ViewerImage[] = [];
  const map = new Map<HTMLImageElement, number>();
  const imgs = root.querySelectorAll<HTMLImageElement>("img");

  imgs.forEach((img) => {
    // Skip tiny / decorative images; only viewer-worthy article photos
    if (img.naturalWidth > 0 && img.naturalWidth < 200) return;

    const figure = img.closest("figure");
    let caption: string | undefined;
    if (figure) {
      const figcap = figure.querySelector("figcaption");
      if (figcap) {
        caption = (figcap.textContent ?? "").replace(/\s+/g, " ").trim();
      }
    }

    map.set(img, images.length);
    images.push({
      src: img.currentSrc || img.src,
      alt: img.alt || "",
      caption,
    });
  });

  return { images, map };
}

export function ImageViewer({ containerRef }: Props) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [fading, setFading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const imagesRef = useRef<ViewerImage[]>([]);
  // Trigger element saved when the viewer opens so we can return
  // focus to it on close — WCAG 2.4.3 (focus order) compliance for
  // modal dialogs.
  const triggerRef = useRef<HTMLElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  // Motion values drive the image's translation. We track x and y
  // separately so we can react to vertical drag (close gesture) and
  // horizontal drag (swipe nav) with different thresholds.
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Bind click handlers to every <img> inside the container.
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;

    const { images, map } = collectImages(root);
    imagesRef.current = images;

    const handler = (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (!target || target.tagName !== "IMG") return;
      const img = target as HTMLImageElement;
      const idx = map.get(img);
      if (idx === undefined) return;
      e.preventDefault();
      triggerRef.current = img;
      setIndex(idx);
      setOpen(true);
    };

    const keyHandler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target || target.tagName !== "IMG") return;
      if (e.key !== "Enter" && e.key !== " ") return;
      const img = target as HTMLImageElement;
      const idx = map.get(img);
      if (idx === undefined) return;
      e.preventDefault();
      triggerRef.current = img;
      setIndex(idx);
      setOpen(true);
    };

    root.addEventListener("click", handler);
    root.addEventListener("keydown", keyHandler);

    // Cursor + a11y: mark images as clickable buttons with an
    // accessible name. WP legacy archive often has empty alt
    // attributes — fall back to a generic label so the role="button"
    // is still operable by screen readers (WCAG 4.1.2).
    map.forEach((_, img) => {
      img.style.cursor = "zoom-in";
      img.setAttribute("role", "button");
      img.setAttribute("tabindex", "0");
      const alt = img.getAttribute("alt")?.trim();
      img.setAttribute(
        "aria-label",
        alt && alt !== ""
          ? `Open photograph: ${alt}`
          : "Open photograph in viewer"
      );
    });

    return () => {
      root.removeEventListener("click", handler);
      root.removeEventListener("keydown", keyHandler);
    };
  }, [containerRef]);

  const close = useCallback(() => {
    setOpen(false);
    x.set(0);
    y.set(0);
  }, [x, y]);

  const swap = useCallback(
    (delta: number) => {
      const len = imagesRef.current.length;
      if (len === 0) return;
      const next = (index + delta + len) % len;
      setFading(true);
      window.setTimeout(() => {
        setIndex(next);
        setFading(false);
        x.set(0);
        y.set(0);
      }, 150);
    },
    [index, x, y]
  );

  const onDragEnd = useCallback(
    (_e: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      const { offset, velocity } = info;

      // Dismiss on down-drag: animate the image off the bottom of the
      // viewport, then close. The overlay's opacity is bound to y, so
      // it fades to match.
      if (
        offset.y > SWIPE_CLOSE_DISTANCE ||
        velocity.y > SWIPE_CLOSE_VELOCITY
      ) {
        const exit = window.innerHeight;
        animate(y, exit, {
          duration: 0.28,
          ease: [0.4, 0, 1, 1],
          onComplete: () => close(),
        });
        return;
      }

      // Swap on horizontal drag: trigger swap and let the existing
      // fade-cycle reset x/y to 0 (via the setTimeout in swap()).
      if (
        Math.abs(offset.x) > SWIPE_NAV_DISTANCE ||
        Math.abs(velocity.x) > SWIPE_NAV_VELOCITY
      ) {
        if (offset.x < 0) swap(1);
        else swap(-1);
        return;
      }

      // No action threshold met: motion's dragSnapToOrigin springs
      // x and y back to 0 automatically.
    },
    [close, swap, y]
  );

  // Keyboard navigation, body scroll lock, focus trap, and focus
  // restoration when open. WCAG 2.1.2 (no keyboard trap to background)
  // + 2.4.3 (focus order: return to trigger after close).
  useEffect(() => {
    if (!open) return;

    // Move focus to the close button so screen readers announce the
    // dialog's purpose immediately, and Tab cycles within the modal.
    closeButtonRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close();
        return;
      }
      if (e.key === "ArrowRight") {
        swap(1);
        return;
      }
      if (e.key === "ArrowLeft") {
        swap(-1);
        return;
      }
      if (e.key !== "Tab") return;

      // Focus trap: keep keyboard focus inside the overlay. Cycle to
      // the first tabbable on Tab past the last, and to the last on
      // Shift+Tab before the first.
      const overlay = overlayRef.current;
      if (!overlay) return;
      const focusables = overlay.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      // Restore focus to the image that opened the viewer so keyboard
      // users land back at their place in the article.
      triggerRef.current?.focus();
    };
  }, [open, close, swap]);

  if (!mounted) return null;

  const total = imagesRef.current.length;
  const current = imagesRef.current[index];
  if (!current) return null;

  return createPortal(
    <div
      ref={overlayRef}
      className={`${styles.overlay}${open ? " " + styles.overlayOpen : ""}`}
      onClick={close}
      role="dialog"
      aria-modal="true"
      aria-label="Image viewer"
    >
      {total > 1 && (
        <p className={styles.counter}>
          {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
        </p>
      )}

      <button
        ref={closeButtonRef}
        type="button"
        aria-label="Close viewer"
        className={styles.close}
        onClick={(e) => {
          e.stopPropagation();
          close();
        }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"
            fill="currentColor"
          />
        </svg>
      </button>

      {total > 1 && (
        <>
          <button
            type="button"
            aria-label="Previous image"
            className={`${styles.nav} ${styles.navPrev}`}
            onClick={(e) => {
              e.stopPropagation();
              swap(-1);
            }}
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M15.41 16.59L10.83 12l4.58-4.59L14 6l-6 6 6 6z" fill="currentColor" />
            </svg>
          </button>
          <button
            type="button"
            aria-label="Next image"
            className={`${styles.nav} ${styles.navNext}`}
            onClick={(e) => {
              e.stopPropagation();
              swap(1);
            }}
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z" fill="currentColor" />
            </svg>
          </button>
        </>
      )}

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <motion.img
        className={`${styles.image}${fading ? " " + styles.fading : ""}`}
        src={current.src}
        alt={current.alt}
        onClick={(e) => e.stopPropagation()}
        draggable={false}
        // Drag both axes — vertical handles close, horizontal handles
        // swipe-nav. dragElastic gives the image a slightly rubbery
        // feel as it leaves the viewport edges; dragSnapToOrigin
        // returns the image to (0,0) on release unless onDragEnd took
        // an explicit close/swap action first. Spring tuning here is
        // moderately stiff so the snap-back lands without overshoot.
        drag
        dragSnapToOrigin
        dragElastic={0.4}
        dragTransition={{ bounceStiffness: 600, bounceDamping: 30 }}
        onDragEnd={onDragEnd}
        style={{ x, y }}
      />
      {current.caption && (
        <p className={styles.caption} onClick={(e) => e.stopPropagation()}>
          {current.caption}
        </p>
      )}
    </div>,
    document.body
  );
}
