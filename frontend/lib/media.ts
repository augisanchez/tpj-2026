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
