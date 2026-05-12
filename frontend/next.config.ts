import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Enables React 19's <ViewTransition> component so route navigations
    // can be coordinated browser-side (outgoing fade + incoming fade,
    // plus shared-element morphs). Gated behind a Next.js experimental
    // flag in 16.x. Required for components/PageTransition.tsx and any
    // future ViewTransition usage.
    viewTransition: true,
  },
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
