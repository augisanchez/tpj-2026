import { fetchExplore } from "@/lib/queries/explore";
import { fetchPhotographersIndex } from "@/lib/queries/photographers-index";
import { THEMES } from "@/lib/themes";
import { cdnImageUrl } from "@/lib/cdn";
import { decodeHtmlEntities } from "@/lib/text-utils";
import type { SearchIndex } from "@/lib/search-index";

// Rebuilt with the rest of the site (hourly, or when WordPress saves:
// app/api/revalidate refreshes this path on every save).
export const revalidate = 3600;

const THEME_NAME = new Map(THEMES.map((t) => [t.slug, t.name]));

/** The quick-search index (lib/search-index.ts). About 50 KB gzipped,
 *  fetched by the search overlay the first time someone reaches for it. */
export async function GET() {
  const [stories, artists] = await Promise.all([
    fetchExplore(1000),
    fetchPhotographersIndex().catch(() => []),
  ]);
  const body: SearchIndex = {
    stories: stories.map((s) => ({
      t: decodeHtmlEntities(s.title).trim(),
      h: `/${s.contentType}/${s.slug}`,
      p: s.photographer ? decodeHtmlEntities(s.photographer).trim() : null,
      k: s.contentType,
      y: s.date ? Number(s.date.slice(0, 4)) || null : null,
      // Shown at 96px (overlay) and 160px (results page); 320 covers 2x.
      i: s.featuredImage ? cdnImageUrl(s.featuredImage.src, { width: 320 }) : null,
      // Shuffle on Continue the thread builds full cards from these.
      s: s.featuredImage?.src ?? null,
      d: s.date ? s.date.slice(0, 10) : null,
      th: s.themes.map((slug) => THEME_NAME.get(slug)).filter((n): n is string => Boolean(n)),
    })),
    artists: artists.map((a) => ({
      n: a.name,
      h: `/artist/${a.slug}`,
      c: a.articleCount,
      i: a.portrait ? cdnImageUrl(a.portrait.src, { width: 160 }) : null,
    })),
    themes: THEMES.map((t) => ({ n: t.name, h: `/theme/${t.slug}`, p: t.prompt })),
  };
  return Response.json(body);
}
