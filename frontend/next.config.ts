import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
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
