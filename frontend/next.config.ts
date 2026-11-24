import type { NextConfig } from "next";
import legacyTags from "./lib/legacy-tag-redirects.json";

// Old WordPress archive URLs (from the live site's sitemap) and where
// each lands on the new site. Tags were mapped one by one: photographer,
// theme or article when the slug matches one, otherwise a search.
const LEGACY_CATEGORY: Record<string, string> = {
  reviews: "/explore?type=feature",
  "tpj-spotlight": "/explore?type=interview",
  celebrity: "/explore?type=interview",
  "sally-reynolds": "/photographer/sally-reynolds",
};

/** Where WordPress uploads live now (media domain, or the temporary proxy). */
const MEDIA_BASE = `${process.env.NEXT_PUBLIC_CDN_BASE ?? "https://media.thephotographicjournal.com"}${process.env.NEXT_PUBLIC_CDN_PATH_PREFIX ?? "/tpj"}`;

/** Legacy URLs often end in "/". Accept both forms in one rule, so every
 *  old link resolves in a single redirect (Next's own slash redirect is
 *  off; a catch-all at the end strips slashes for everything else). */
type Redirect = { source: string; destination: string; permanent: boolean };
const slashOptional = (r: Redirect): Redirect =>
  r.source.endsWith("/") || r.source.includes(":path") ? r : { ...r, source: `${r.source}{/}?` };

const MEDIA_HOSTS = "https://cms.thephotographicjournal.com https://media.thephotographicjournal.com";
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://vercel.live https://challenges.cloudflare.com",
  "style-src 'self' 'unsafe-inline' https://vercel.live",
  `img-src 'self' data: blob: ${MEDIA_HOSTS} https://vercel.live https://vercel.com`,
  "font-src 'self' https://vercel.live https://assets.vercel.com",
  `media-src 'self' ${MEDIA_HOSTS}`,
  "connect-src 'self' https://usebasin.com https://vercel.live wss://ws-us3.pusher.com https://challenges.cloudflare.com",
  "frame-src https://challenges.cloudflare.com https://player.vimeo.com https://www.youtube.com https://www.youtube-nocookie.com https://vercel.live",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self' https://usebasin.com",
  "object-src 'none'",
  "report-uri /api/csp-report",
].join("; ");

const nextConfig: NextConfig = {
  skipTrailingSlashRedirect: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
          // Report-only: blocks nothing, logs what it would block to
          // /api/csp-report. Enforce after launch once the logs are clean
          // (see docs/CUTOVER.md). Article bodies are WordPress HTML, so
          // this is the backstop if a CMS account is ever compromised.
          { key: "Content-Security-Policy-Report-Only", value: CSP },
        ],
      },
      {
        // Only the public domain is indexable. v2., previews and any other
        // host get noindex as a header, so launching is just pointing the
        // domain here: no setting to remember.
        source: "/:path*",
        missing: [{ type: "host", value: "(www\\.)?thephotographicjournal\\.com" }],
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      {
        // Static art in /public: cache a week, serve stale while it refreshes.
        source: "/:dir(svg|about|photographers|shop)/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=2592000" },
        ],
      },
    ];
  },
  async redirects() {
    const rules: Redirect[] = [
      ...(legacyTags as [string, string][]).map(([tag, to]) => ({
        source: `/tag/${tag}`,
        destination: to,
        permanent: true,
      })),
      ...Object.entries(LEGACY_CATEGORY).map(([cat, to]) => ({
        source: `/category/${cat}`,
        destination: to,
        permanent: true,
      })),
      { source: "/category/:slug", destination: "/explore", permanent: true },
      { source: "/tag/:slug", destination: "/explore", permanent: true },
      { source: "/author/:slug", destination: "/about", permanent: true },
      { source: "/submissions", destination: "/submit", permanent: true },
      { source: "/articles-essays", destination: "/explore?type=essay", permanent: true },
      { source: "/articles-interviews", destination: "/explore?type=interview", permanent: true },
      { source: "/articles-features", destination: "/explore?type=feature", permanent: true },
      // v1 / WordPress permalinks are plural; v2 routes are singular.
      // Keeps old links, search results and wp-admin "View" links alive.
      // Two archive slugs were non-ASCII, which Vercel's page cache can't
      // serve; they were renamed in WordPress. Old addresses (both URL
      // forms, singular and plural) land on the new ones.
      ...[
        ["rural-%E9%84%89%E6%9D%91", "rural"],
        ["rural-%e9%84%89%e6%9d%91", "rural"],
        ["rural-鄉村", "rural"],
        ["ma%E1%B9%ADar-%E1%B8%A5amad-al-duwali", "matar-hamad-al-duwali"],
        ["ma%e1%b9%adar-%e1%b8%a5amad-al-duwali", "matar-hamad-al-duwali"],
        ["maṭar-ḥamad-al-duwali", "matar-hamad-al-duwali"],
      ].flatMap(([from, to]) => [
        { source: `/essay/${from}`, destination: `/essay/${to}`, permanent: true },
        { source: `/essays/${from}`, destination: `/essay/${to}`, permanent: true },
      ]),
      { source: "/essays/:slug", destination: "/essay/:slug", permanent: true },
      { source: "/interviews/:slug", destination: "/interview/:slug", permanent: true },
      { source: "/features/:slug", destination: "/feature/:slug", permanent: true },
      { source: "/photographers/:slug", destination: "/photographer/:slug", permanent: true },
      { source: "/essays", destination: "/explore?type=essay", permanent: true },
      { source: "/interviews", destination: "/explore?type=interview", permanent: true },
      { source: "/features", destination: "/explore?type=feature", permanent: true },
      // Editorial Lens → Theme rename (2026-05-04). Permanent so any
      // design-review or staging links forwarded around still resolve.
      { source: "/lenses", destination: "/themes", permanent: true },
      {
        source: "/lens/:slug",
        destination: "/theme/:slug",
        permanent: true,
      },
      // Collections concept removed (2026-05-04). Anything pointed at
      // those URLs is dead; redirect to the closest editorial sibling.
      { source: "/collections", destination: "/themes", permanent: true },
      { source: "/collection/:slug", destination: "/themes", permanent: true },
      // The old static storefront.
      { source: "/store", destination: "/shop", permanent: true },
      { source: "/store/residence", destination: "/shop/residence", permanent: true },
      // Old feed addresses.
      { source: "/rss", destination: "/feed", permanent: true },
      { source: "/rss2", destination: "/feed", permanent: true },
      { source: "/feed/rss2", destination: "/feed", permanent: true },
      { source: "/feed/atom", destination: "/feed", permanent: true },
    ];
    return [
      ...rules.map(slashOptional),
      // Old image links (Pinterest, Google Images, newsletters) go to the
      // same file on the media host. Temporary until the media domain is
      // final (see CUTOVER.md), then make it permanent.
      {
        source: "/wp-content/uploads/:path*",
        destination: `${MEDIA_BASE}/wp-content/uploads/:path*`,
        permanent: false,
      },
      // Everything else: strip a trailing slash in one hop.
      { source: "/:path+/", destination: "/:path+", permanent: true },
    ];
  },
};

export default nextConfig;
