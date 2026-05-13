import {
  cdnImageUrl,
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
 * The single image-rendering surface across the site. Wraps the
 * Cloudflare Image Resizing transform helpers so call sites don't
 * need to know whether the CDN is live yet — pre-cutover, this
 * behaves identically to a plain `<img src={…}>`. Post-cutover, the
 * same call sites automatically pick up responsive srcsets and edge
 * format conversion.
 */
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
  const targetWidth = maxWidth ?? widths[widths.length - 1];
  const finalSrc = cdnImageUrl(src, { width: targetWidth, quality });
  const srcSet = cdnSrcSet(src, widths, quality ? { quality } : undefined);

  if (!finalSrc) return null;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={finalSrc}
      srcSet={srcSet ?? undefined}
      sizes={sizes}
      alt={alt}
      width={width}
      height={height}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      className={className}
      onLoad={onLoad}
      onError={onError}
    />
  );
}
