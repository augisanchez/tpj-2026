import {
  capWidths,
  CDN_BASE,
  CDN_PATH_PREFIX,
  cdnImageUrl,
  cdnSrcSet,
  isCdnEnabled,
  cdnPlaceholderUrl,
  capDensity,
} from "./cdn";

/** Any absolute (or protocol-relative) link into a WordPress uploads
 *  folder on the old hosts. After cutover the live domain serves this
 *  site, which has no uploads folder, so these must point at the CDN. */
const UPLOADS_ORIGIN_RE =
  /(?:https?:)?\/\/(?:www\.)?(?:thephotographicjournal\.com|tpj\.wpengine\.com|tpj\.local)\/wp-content\/uploads\//gi;

const PROD_ORIGIN = "https://thephotographicjournal.com";
const LOCAL_UPLOADS = "http://tpj.local/wp-content/uploads/";
const PROD_UPLOADS = `${PROD_ORIGIN}/wp-content/uploads/`;
const WPENGINE_UPLOADS = "http://tpj.wpengine.com/wp-content/uploads/";

/**
 * Local development reads the v1 production database, but the actual media
 * lives only on the production server. WordPress generates URLs against the
 * configured siteurl (tpj.local), which 404 locally. Rewrite those to the
 * production origin so images load.
 *
 * Also handles three legacy shapes that show up in older photographer
 * meta and article bodies:
 *   - bare `/wp-content/...` relative paths (no host)
 *   - `http://tpj.wpengine.com/...` from a prior staging host
 *   - protocol-relative `//thephotographicjournal.com/...`
 *
 * cms.thephotographicjournal.com URLs pass through untouched: the cms
 * server serves its own uploads and redirects archive files it doesn't
 * hold to the media origin (see cms-server/nginx-cms.conf).
 *
 * Remove once Cloudflare CDN cutover is complete and media URLs in the DB
 * point at media.thephotographicjournal.com directly.
 */
export function rewriteMediaUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith(LOCAL_UPLOADS)) {
    return PROD_UPLOADS + url.slice(LOCAL_UPLOADS.length);
  }
  if (url.startsWith(WPENGINE_UPLOADS)) {
    return PROD_UPLOADS + url.slice(WPENGINE_UPLOADS.length);
  }
  if (url.startsWith("/wp-content/")) {
    return PROD_ORIGIN + url;
  }
  if (url.startsWith("//")) {
    return "https:" + url;
  }
  return url;
}

export function rewriteMediaUrlsInHtml(html: string): string {
  return html
    .split(LOCAL_UPLOADS)
    .join(PROD_UPLOADS)
    .split(WPENGINE_UPLOADS)
    .join(PROD_UPLOADS);
}

/**
 * Default `sizes` for WP-rendered article-body images. Conservative:
 * tells the browser the image renders up to ~1024 CSS px on desktop
 * so it picks a sharp variant on retina without burning bandwidth.
 * Full-bleed figure variants are slightly under-served; revisit if
 * the editor signals soft images on wide displays.
 */
/**
 * Body figures span the content area: viewport minus two gutters
 * (--gutter ≈ 0.5rem + 5vw), so about 90vw on desktop. Multi-image
 * figures split that. Matches ArticleBody/InterviewBody CSS, so the
 * browser picks a file at least as wide as the photo is drawn.
 */
const BODY_SIZES = {
  full: "(min-width: 640px) calc(90vw - 16px), 100vw",
  twoThirds: "(min-width: 768px) calc(60vw - 11px), 100vw",
  twoUp: "(min-width: 640px) calc(45vw - 40px), 50vw",
  threeUp: "(min-width: 768px) calc(30vw - 48px), 50vw",
  margin: "(min-width: 1024px) 280px, 100vw",
} as const;
const ARTICLE_BODY_SIZES = BODY_SIZES.full;
const SIZES_TOKEN = "__TPJ_SIZES__";
const BODY_WIDTHS = [480, 768, 1024, 1440, 1920, 2560, 3200, 3840];

function sizesForFigure(cls: string): string {
  if (/fig-(two-?up)/.test(cls)) return BODY_SIZES.twoUp;
  if (/fig-three-up/.test(cls)) return BODY_SIZES.threeUp;
  if (/fig-two-?thirds/.test(cls)) return BODY_SIZES.twoThirds;
  if (/fig-margin/.test(cls)) return BODY_SIZES.margin;
  return BODY_SIZES.full;
}

const IMG_TAG_RE = /<img\b([^>]*?)\s*\/?\s*>/gi;
const SRC_RE = /\bsrc\s*=\s*["']([^"']+)["']/i;
const SRCSET_RE = /\bsrcset\s*=\s*["'][^"']+["']/i;
const SIZES_RE = /\bsizes\s*=\s*["'][^"']+["']/i;
const LOADING_RE = /\bloading\s*=\s*["'][^"']+["']/i;

/**
 * Server-side: rewrite every `<img>` in WP-rendered article HTML to
 * route through Cloudflare Image Resizing and gain a responsive
 * `srcset` + `sizes` + lazy-loading.
 *
 * No-op when `NEXT_PUBLIC_CDN_BASE` is unset (matches `lib/cdn.ts`
 * pre-cutover behaviour). Pure regex because WP markup is trusted
 * and uniform; full DOM parsing isn't worth the dependency. Skips
 * tags that already declare `srcset` so an editor-set variant
 * isn't overridden.
 */
/**
 * Wrap a body <img> in a frame with the image's own proportions, so the
 * loading placeholder is exactly the photo's size and nothing below it
 * moves when the photo arrives. Without width/height the frame has no
 * ratio, and the CSS gives it a provisional one until the image loads.
 */
function frameImage(imgTag: string): string {
  const w = /\swidth=["']?(\d+)/i.exec(imgTag)?.[1];
  const h = /\sheight=["']?(\d+)/i.exec(imgTag)?.[1];
  const style = w && h && +w > 0 && +h > 0 ? ` style="aspect-ratio:${w}/${h}"` : "";
  return `<span class="img-frame"${style}>${imgTag}</span>`;
}

export function rewriteArticleBodyImages(html: string): string {
  if (!isCdnEnabled()) return html.replace(IMG_TAG_RE, (m) => frameImage(m));
  const out = html.replace(IMG_TAG_RE, (match, rawAttrs: string) => {
    const srcMatch = SRC_RE.exec(rawAttrs);
    if (!srcMatch) return frameImage(match);
    // WordPress's own srcset points at old-host sub-size files; replace
    // it with CDN widths so every body image is resized at the edge.
    rawAttrs = rawAttrs.replace(SRCSET_RE, "").replace(SIZES_RE, "");

    const originalSrc = srcMatch[1];
    // Candidates up to 3840 for full-bleed figures on big screens, never
    // wider than the file itself (Cloudflare doesn't upscale).
    const intrinsic = Number(/\swidth=["']?(\d+)/i.exec(rawAttrs)?.[1]) || undefined;
    const widths = capWidths(BODY_WIDTHS, intrinsic);
    const cdnSrc = cdnImageUrl(originalSrc, { width: Math.min(2560, widths[widths.length - 1]) });
    const srcSet = cdnSrcSet(originalSrc, widths);
    if (!cdnSrc || !srcSet) return frameImage(match);

    let attrs = rawAttrs.replace(SRC_RE, `src="${cdnSrc}"`);
    attrs += ` srcset="${srcSet}"`;
    attrs += ` sizes="${SIZES_TOKEN}"`;
    if (!LOADING_RE.test(attrs)) attrs += ` loading="lazy"`;
    // Blur-up source; MotionRoot applies it as the image nears the
    // viewport (globals.css "Blur-up"), so offscreen photos cost nothing.
    const lqip = cdnPlaceholderUrl(originalSrc);
    if (lqip) attrs += ` data-lqip-src="${lqip}"`;
    return frameImage(`<img${attrs}>`);
  });
  // Each image's sizes follows the figure it sits in (full, two-up…).
  return out
    .replace(/<figure\b[^>]*\bclass=["']([^"']*)["'][^>]*>[\s\S]*?<\/figure>/gi, (fig, cls: string) =>
      fig.split(SIZES_TOKEN).join(capDensity(sizesForFigure(cls))),
    )
    .split(SIZES_TOKEN)
    .join(capDensity(ARTICLE_BODY_SIZES));
}

/**
 * Compose the two HTML transforms applied to every article body
 * before it reaches the client. URL canonicalisation runs first
 * (dev origins → prod), then the CDN srcset injection.
 */
/**
 * Empty alt text on body photos (most of the archive) means screen
 * readers skip the photographs entirely. Fill it from the order and the
 * credit: "Photograph 3 of 11 by Etienne Perrone". Real alt text wins.
 */
function fillEmptyAlt(html: string, credit?: string | null): string {
  const total = (html.match(IMG_TAG_RE) ?? []).length;
  let n = 0;
  return html.replace(IMG_TAG_RE, (tag) => {
    n += 1;
    const alt = /\salt\s*=\s*(["'])(.*?)\1/i.exec(tag);
    if (alt && alt[2].trim()) return tag;
    const label = `Photograph ${n} of ${total}${credit ? ` by ${credit}` : ""}`.replace(/"/g, "&quot;");
    const withoutAlt = alt ? tag.replace(alt[0], "") : tag;
    return withoutAlt.replace(/^<img\b/i, `<img alt="${label}"`);
  });
}

export function prepareArticleBodyHtml(html: string, opts: { credit?: string | null } = {}): string {
  const withImages = rewriteArticleBodyImages(fillEmptyAlt(rewriteMediaUrlsInHtml(html), opts.credit));
  if (!isCdnEnabled()) return withImages;
  // Everything else that links into uploads (full-size links, video
  // sources, posters) goes to the original file on the CDN.
  return withImages.replace(
    UPLOADS_ORIGIN_RE,
    `${CDN_BASE}${CDN_PATH_PREFIX}/wp-content/uploads/`,
  );
}
