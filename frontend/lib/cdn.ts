import { rewriteMediaUrl } from "./media";

/**
 * Build a Cloudflare Image Resizing URL from a raw WP media URL.
 *
 * Two modes:
 *  - **Pre-cutover (no `NEXT_PUBLIC_CDN_BASE`):** returns
 *    `rewriteMediaUrl(rawUrl)` unchanged. The page sees the same
 *    image URL it sees today; no edge transforms.
 *  - **Post-cutover (`NEXT_PUBLIC_CDN_BASE` set):** returns
 *    `{base}/cdn-cgi/image/width=...,quality=(level=75,slow-connection=45),format=auto/{path}`,
 *    which routes through Cloudflare Image Resizing.
 *
 * The wrapper lets us ship `<TpjImage>` across every call site now
 * and flip the CDN behaviour with a single env var at launch.
 */
export type CdnImageOpts = {
  width?: number;
  /** With fit "cover": crop to exactly width x height. */
  height?: number;
  fit?: "cover" | "scale-down" | "contain";
  /** Where to keep when cropping: "face" keeps faces (center if none),
   *  "auto" finds the most salient area. */
  gravity?: "face" | "auto" | "top" | "center";
  /** Fixed quality (OG cards, feeds, thumbnails). Omit for the site
   *  default: 75, dropping to 45 on slow connections. */
  quality?: number;
  /** Quality on a slow connection (Save-Data, or Chromium's ECT 3g or
   *  slower, RTT over 150ms, downlink under 5Mbps; see Accept-CH in
   *  next.config). Only applies with the default quality. */
  slowQuality?: number;
  format?: "auto" | "webp" | "avif" | "jpeg" | "png";
};

/** AVIF/WebP at 75 is visually the same as 85 for photographs at about a
 *  third fewer bytes. Cloudflare swaps in SLOW_QUALITY when the browser
 *  reports a slow connection or data saver (Chromium only; Safari and
 *  Firefox always get DEFAULT_QUALITY). Measured 768px AVIF: 32KB vs 13KB. */
export const DEFAULT_QUALITY = 75;
export const SLOW_QUALITY = 45;

export const CDN_BASE = process.env.NEXT_PUBLIC_CDN_BASE;
/** Key prefix of the WordPress uploads inside the media bucket (R2 keys are
 *  tpj/wp-content/uploads/...). */
export const CDN_PATH_PREFIX = process.env.NEXT_PUBLIC_CDN_PATH_PREFIX ?? "";

export function isCdnEnabled(): boolean {
  return Boolean(CDN_BASE);
}

export function cdnImageUrl(
  rawUrl: string | null | undefined,
  opts: CdnImageOpts = {}
): string | null {
  const url = rewriteMediaUrl(rawUrl);
  if (!url) return null;
  if (!CDN_BASE) return url;

  let path: string;
  try {
    path = new URL(url).pathname;
  } catch {
    return url;
  }

  const params = [
    typeof opts.width === "number" ? `width=${opts.width}` : null,
    typeof opts.height === "number" ? `height=${opts.height}` : null,
    opts.fit ? `fit=${opts.fit}` : null,
    opts.gravity ? `gravity=${opts.gravity}` : null,
    typeof opts.quality === "number"
      ? `quality=${opts.quality}`
      : `quality=(level=${DEFAULT_QUALITY},slow-connection=${opts.slowQuality ?? SLOW_QUALITY})`,
    `format=${opts.format ?? "auto"}`,
  ]
    .filter((p): p is string => p !== null)
    .join(",");

  // Only WordPress uploads live in the media bucket; anything else (site
  // SVGs, external shop images) is served as-is.
  if (!path.startsWith("/wp-content/uploads/")) return url;
  return `${CDN_BASE}/cdn-cgi/image/${params}${CDN_PATH_PREFIX}${path}`;
}

/** Default srcset widths for editorial photography — mobile portrait
 *  through 5K display. */
export const DEFAULT_WIDTHS = [480, 768, 1024, 1440, 1920, 2560];

/**
 * Build a `srcset` string for an image at the given widths. Returns
 * `null` when CDN is disabled (each width would resolve to the same
 * source URL, making the srcset useless).
 */
export function cdnSrcSet(
  rawUrl: string | null | undefined,
  widths: number[] = DEFAULT_WIDTHS,
  opts: Omit<CdnImageOpts, "width"> = {}
): string | null {
  if (!isCdnEnabled()) return null;
  if (!rawUrl) return null;
  const entries = widths
    .map((w) => {
      const url = cdnImageUrl(rawUrl, { ...opts, width: w });
      return url && url.includes("/cdn-cgi/image/") ? `${url} ${w}w` : null;
    })
    .filter((s): s is string => s !== null);
  if (entries.length === 0) return null;
  return entries.join(", ");
}

/**
 * Drop srcset candidates wider than the original (Cloudflare never
 * upscales, so they'd all be the same file) and add the original's own
 * width as the top candidate.
 */
export function capWidths(widths: number[], intrinsic?: number | null): number[] {
  if (!intrinsic || intrinsic <= 0) return widths;
  const kept = widths.filter((w) => w < intrinsic);
  if (intrinsic < widths[widths.length - 1]) kept.push(intrinsic);
  return kept.length ? kept : widths;
}
