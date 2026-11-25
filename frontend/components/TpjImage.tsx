"use client";

import { useEffect, useRef, useState } from "react";
import {
  capDensity,
  capWidths,
  cdnImageUrl,
  cdnPlaceholderUrl,
  cdnSrcSet,
  DEFAULT_WIDTHS,
  type CdnImageOpts,
} from "@/lib/cdn";

type Props = {
  src: string | null | undefined;
  alt: string;
  /**
   * The `sizes` attribute. Required for correct srcset selection on
   * wide displays. Pass per-context — e.g. `100vw` for hero images,
   * `(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw` for
   * 3-up grid cards.
   */
  sizes: string;
  /**
   * Override the default srcset widths. Useful when you know an
   * image will never be rendered larger than a certain size (e.g.
   * thumbnails) and want to skip the larger CDN variants.
   */
  widths?: number[];
  /** Used as the `width` attribute. Aids layout stability. */
  width?: number;
  /** Used as the `height` attribute. Aids layout stability. */
  height?: number;
  /**
   * `priority=true` flags this image as critical (above the fold).
   * Sets `loading="eager"` and `fetchpriority="high"` so the browser
   * deprioritises lazy images for it. Default false.
   */
  priority?: boolean;
  className?: string;
  /**
   * Largest width the image is ever rendered at — used as the `src`
   * fallback (single-image src for browsers that don't honour
   * srcset, plus the URL the CDN is asked for when CDN is disabled).
   * Defaults to the largest entry in `widths`.
   */
  maxWidth?: number;
  quality?: CdnImageOpts["quality"];
  onLoad?: () => void;
  onError?: () => void;
};

/**
 * Client component on purpose: React turns a server-rendered high-
 * priority <img> into an image preload hint inside the RSC payload, so
 * every prefetched link pre-downloaded that page's hero photo. Rendered
 * from a client component, the hint is only emitted in the HTML of a
 * real page load.
 *
 * The single image-rendering surface across the site. Wraps the
 * Cloudflare Image Resizing transform helpers so call sites don't
 * need to know whether the CDN is live yet — pre-cutover, this
 * behaves identically to a plain `<img src={…}>`. Post-cutover, the
 * same call sites automatically pick up responsive srcsets and edge
 * format conversion.
 */
/**
 * Swap a failed /cdn-cgi/image/ resize for the original file, once. The
 * head script in layout.tsx does the same for images that fail before
 * hydration; this covers the ones React sees. Returns true when a retry
 * is in flight (or already was), false when there is nothing left to try.
 */
function tryOriginal(img: HTMLImageElement): boolean {
  if (img.dataset.cdnFb) return !img.complete;
  const current = img.currentSrc || img.src || "";
  if (current.indexOf("/cdn-cgi/image/") < 0) return false;
  img.dataset.cdnFb = "1";
  img.removeAttribute("srcset");
  img.src = current.replace(/\/cdn-cgi\/image\/[^/]+/, "");
  return true;
}

export function TpjImage({
  src,
  alt,
  sizes,
  widths = DEFAULT_WIDTHS,
  width,
  height,
  priority = false,
  className,
  maxWidth,
  quality,
  onLoad,
  onError,
}: Props) {
  const ref = useRef<HTMLImageElement>(null);
  const [failed, setFailed] = useState(false);

  // An image that failed before hydration never reaches onError; catch it
  // on mount so the caller's fallback (initials, placeholder) still runs.
  useEffect(() => {
    const img = ref.current;
    if (img && img.complete && img.naturalWidth === 0 && img.currentSrc) {
      if (tryOriginal(img)) return;
      setFailed(true);
      onError?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Blur-up (globals.css "Blur-up"): a tiny blurred copy sits behind the
  // image with a faint shimmer until the real one has loaded and decoded,
  // then the photo comes into focus. Priority images carry it in the
  // server HTML so it paints with the page; the rest get it as they near
  // the viewport, so offscreen images cost nothing. Already-loaded
  // (cached) images skip the effect.
  // Placeholders cost a Cloudflare resize each, so only priority images
  // (heroes, the first screen) get one; the rest show the shimmer alone.
  const lqip = priority ? cdnPlaceholderUrl(src) : null;
  useEffect(() => {
    const img = ref.current;
    if (!img || !lqip) return;
    if (img.complete && img.naturalWidth > 0) {
      img.dataset.cached = "1";
      return;
    }
    if (priority) return;
    const apply = () => {
      if (img.complete) return;
      img.style.setProperty("--lqip", `url("${lqip}")`);
      img.dataset.lqip = "";
    };
    if (typeof IntersectionObserver === "undefined") {
      apply();
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        apply();
        io.disconnect();
      },
      { rootMargin: "600px 0px" }
    );
    io.observe(img);
    return () => io.disconnect();
  }, [lqip, priority]);

  // Never ask the CDN for more pixels than the original has (Cloudflare
  // doesn't upscale, so larger candidates are the same file, stretched).
  const list = capWidths(widths, width);
  const targetWidth = Math.min(maxWidth ?? list[list.length - 1], list[list.length - 1]);
  const finalSrc = cdnImageUrl(src, { width: targetWidth, quality });
  const srcSet = cdnSrcSet(src, list, quality ? { quality } : undefined);

  if (!finalSrc || failed) return null;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={ref}
      src={finalSrc}
      srcSet={srcSet ?? undefined}
      sizes={capDensity(sizes)}
      alt={alt}
      width={width}
      height={height}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      className={className}
      data-fade=""
      data-lqip={priority && lqip ? "" : undefined}
      style={priority && lqip ? ({ "--lqip": `url("${lqip}")` } as React.CSSProperties) : undefined}
      onLoad={onLoad}
      onError={(e) => {
        // A failed edge resize (e.g. Cloudflare's transformation quota,
        // error 9422) falls back to the original file. Only give up when
        // the original fails too.
        if (tryOriginal(e.currentTarget)) return;
        setFailed(true);
        onError?.();
      }}
    />
  );
}
