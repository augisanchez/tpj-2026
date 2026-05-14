import {
  cdnImageUrl,
  cdnSrcSet,
  DEFAULT_WIDTHS,
  isCdnEnabled,
} from "./cdn";

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
const ARTICLE_BODY_SIZES = "(min-width: 1024px) 1024px, 100vw";

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
export function rewriteArticleBodyImages(html: string): string {
  if (!isCdnEnabled()) return html;
  return html.replace(IMG_TAG_RE, (match, rawAttrs: string) => {
    const srcMatch = SRC_RE.exec(rawAttrs);
    if (!srcMatch) return match;
    if (SRCSET_RE.test(rawAttrs)) return match;

    const originalSrc = srcMatch[1];
    const maxWidth = DEFAULT_WIDTHS[DEFAULT_WIDTHS.length - 1];
    const cdnSrc = cdnImageUrl(originalSrc, { width: maxWidth });
    const srcSet = cdnSrcSet(originalSrc);
    if (!cdnSrc || !srcSet) return match;

    let attrs = rawAttrs.replace(SRC_RE, `src="${cdnSrc}"`);
    attrs += ` srcset="${srcSet}"`;
    if (!SIZES_RE.test(attrs)) attrs += ` sizes="${ARTICLE_BODY_SIZES}"`;
    if (!LOADING_RE.test(attrs)) attrs += ` loading="lazy"`;
    return `<img${attrs}>`;
  });
}

/**
 * Compose the two HTML transforms applied to every article body
 * before it reaches the client. URL canonicalisation runs first
 * (dev origins → prod), then the CDN srcset injection.
 */
export function prepareArticleBodyHtml(html: string): string {
  return rewriteArticleBodyImages(rewriteMediaUrlsInHtml(html));
}
