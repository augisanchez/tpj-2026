import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
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
    ];
  },
};

export default nextConfig;
