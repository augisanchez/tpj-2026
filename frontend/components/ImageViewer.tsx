"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useDrag } from "@use-gesture/react";
import styles from "./ImageViewer.module.css";

const SWIPE_NAV_DISTANCE = 80;
const SWIPE_NAV_VELOCITY = 0.3;
const SWIPE_CLOSE_DISTANCE = 100;
const SWIPE_CLOSE_VELOCITY = 0.5;

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
  const [drag, setDrag] = useState({ x: 0, y: 0, active: false });
  const imagesRef = useRef<ViewerImage[]>([]);

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
      setIndex(idx);
      setOpen(true);
    };

    root.addEventListener("click", handler);

    // Cursor + a11y polish: mark images as clickable
    map.forEach((_, img) => {
      img.style.cursor = "zoom-in";
      img.setAttribute("role", "button");
      img.setAttribute("tabindex", "0");
    });

    return () => {
      root.removeEventListener("click", handler);
    };
  }, [containerRef]);

  const close = useCallback(() => setOpen(false), []);

  const swap = useCallback(
    (delta: number) => {
      const len = imagesRef.current.length;
      if (len === 0) return;
      const next = (index + delta + len) % len;
      setFading(true);
      setTimeout(() => {
        setIndex(next);
        setFading(false);
      }, 150);
    },
    [index]
  );

  const bindDrag = useDrag(
    ({ down, movement: [mx, my], velocity: [vx, vy], direction: [, dy] }) => {
      if (down) {
        setDrag({ x: mx, y: Math.max(0, my), active: true });
        return;
      }
      setDrag({ x: 0, y: 0, active: false });
      if (my > SWIPE_CLOSE_DISTANCE || (vy > SWIPE_CLOSE_VELOCITY && dy > 0)) {
        close();
        return;
      }
      if (Math.abs(mx) > SWIPE_NAV_DISTANCE || (vx > SWIPE_NAV_VELOCITY && Math.abs(mx) > 20)) {
        if (mx < 0) swap(1);
        else if (mx > 0) swap(-1);
      }
    },
    { filterTaps: true, pointer: { touch: true } }
  );

  // Keyboard navigation and body scroll lock when open
  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") swap(1);
      else if (e.key === "ArrowLeft") swap(-1);
    };

    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, close, swap]);

  if (!mounted) return null;

  const total = imagesRef.current.length;
  const current = imagesRef.current[index];
  if (!current) return null;

  return createPortal(
    <div
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
      <img
        className={`${styles.image}${fading ? " " + styles.fading : ""}`}
        src={current.src}
        alt={current.alt}
        onClick={(e) => e.stopPropagation()}
        draggable={false}
        style={
          drag.active
            ? {
                transform: `translate(${drag.x}px, ${drag.y}px)`,
                transition: "none",
              }
            : undefined
        }
        {...bindDrag()}
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
