import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { SITE_URL } from "@/lib/seo";

/** The public domain. Every other host (v2., previews) stays out of search. */
const PUBLIC_HOST = /^(www\.)?thephotographicjournal\.com$/i;

export default async function robots(): Promise<MetadataRoute.Robots> {
  const host = ((await headers()).get("host") ?? "").split(":")[0];
  if (!PUBLIC_HOST.test(host)) {
    // Staging: crawlers may fetch pages so they see the X-Robots-Tag
    // noindex header (next.config.ts); a Disallow would hide it.
    return { rules: { userAgent: "*", allow: "/" } };
  }
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/search"] },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
