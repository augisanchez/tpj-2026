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
  /** Gaussian blur radius (Cloudflare `blur`, 1 to 250). */
  blur?: number;
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
    typeof opts.blur === "number" ? `blur=${opts.blur}` : null,
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

/**
 * The blur-up placeholder: the same photo 32px wide, low quality and
 * pre-blurred at the edge (about 0.5KB), drawn under the real image
 * while it loads. Null when the CDN is off or the image isn't a
 * WordPress upload, so callers simply skip the effect.
 */
export function cdnPlaceholderUrl(rawUrl: string | null | undefined): string | null {
  const url = cdnImageUrl(rawUrl, { width: 32, quality: 40, blur: 2 });
  return url && url.includes("/cdn-cgi/image/") ? url : null;
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

/**
 * Cap how dense a srcset pick can get. Phones with 3x screens multiply
 * the slot width by 3 and pull, say, the 1440px file for a 390px-wide
 * photo; the difference from the 2x file is hard to see on a phone and
 * costs about 40% more bytes. For screens at 2.5dppx and up, this adds
 * a copy of every `sizes` entry scaled by maxDppx / 3, listed first so
 * it wins, which makes the browser choose roughly the 2x candidate.
 */
export function capDensity(sizes: string, maxDppx = 2): string {
  const entries = splitTopLevel(sizes);
  if (!entries.length) return sizes;
  const factor = (maxDppx / 3).toFixed(3);
  const HI = "(min-resolution: 2.5dppx)";
  const capped: string[] = [];
  for (const entry of entries) {
    const { cond, len } = splitEntry(entry);
    if (!len || len === "auto") return sizes;
    const scaled = `calc(${len} * ${factor})`;
    if (!cond) capped.push(`${HI} ${scaled}`);
    // "(a) or (b)" needs its own parentheses to combine with "and".
    else capped.push(`${HI} and ${/\sor\s/i.test(cond) ? `(${cond})` : cond} ${scaled}`);
  }
  return [...capped, ...entries].join(", ");
}

/** Split on top-level commas (not those inside min(), calc() or a condition). */
function splitTopLevel(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of s) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      out.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/**
 * "(min-width: 900px) 50vw" -> { cond, len }. The condition is a run of
 * parenthesised groups joined by and/or/not; the length is what follows.
 */
function splitEntry(entry: string): { cond: string; len: string } {
  const re = /^\s*(?:not\s+)?\([^()]*(?:\([^()]*\)[^()]*)*\)(?:\s+(?:and|or)\s+(?:not\s+)?\([^()]*(?:\([^()]*\)[^()]*)*\))*/i;
  const m = entry.match(re);
  if (!m) return { cond: "", len: entry.trim() };
  return { cond: m[0].trim(), len: entry.slice(m[0].length).trim() };
}
