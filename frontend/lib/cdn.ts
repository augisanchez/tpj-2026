import { rewriteMediaUrl } from "./media";

/**
 * Build a Cloudflare Image Resizing URL from a raw WP media URL.
 *
 * Two modes:
 *  - **Pre-cutover (no `NEXT_PUBLIC_CDN_BASE`):** returns
 *    `rewriteMediaUrl(rawUrl)` unchanged. The page sees the same
 *    image URL it sees today; no edge transforms.
 *  - **Post-cutover (`NEXT_PUBLIC_CDN_BASE` set):** returns
 *    `{base}/cdn-cgi/image/width=...,format=auto,quality=85/{path}`,
 *    which routes through Cloudflare Image Resizing.
 *
 * The wrapper lets us ship `<TpjImage>` across every call site now
 * and flip the CDN behaviour with a single env var at launch.
 */
export type CdnImageOpts = {
  width?: number;
  quality?: number;
  format?: "auto" | "webp" | "avif" | "jpeg" | "png";
};

const CDN_BASE = process.env.NEXT_PUBLIC_CDN_BASE;
/** Key prefix of the WordPress uploads inside the media bucket (R2 keys are
 *  tpj/wp-content/uploads/...). */
const CDN_PATH_PREFIX = process.env.NEXT_PUBLIC_CDN_PATH_PREFIX ?? "";

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
    `quality=${opts.quality ?? 85}`,
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
