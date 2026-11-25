import type { MetadataRoute } from "next";
import { fetchExplore } from "@/lib/queries/explore";
import { fetchPhotographersIndex } from "@/lib/queries/photographers-index";
import { SITE_URL } from "@/lib/seo";
import { THEMES } from "@/lib/themes";

// Rebuilt hourly from the same cached lists the site already uses.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [articles, photographers] = await Promise.all([
    fetchExplore(1000),
    fetchPhotographersIndex(),
  ]);
  const page = (path: string, lastModified?: string): MetadataRoute.Sitemap[number] => ({
    url: `${SITE_URL}${path}`,
    ...(lastModified ? { lastModified } : {}),
  });
  return [
    ...["/", "/explore", "/themes", "/artists", "/about", "/shop", "/submit", "/contact"].map((p) => page(p)),
    ...THEMES.map((t) => page(`/theme/${t.slug}`)),
    ...articles.map((a) => page(`/${a.contentType}/${a.slug}`, a.date)),
    ...photographers.map((p) => page(`/artist/${p.slug}`)),
  ];
}
