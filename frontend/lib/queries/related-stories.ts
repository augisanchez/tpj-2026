import type { Photographer } from "@/lib/photographer-types";
import { fetchEssaysByTheme } from "./essays-by-theme";
import { fetchPhotographerArticles, type PhotographerArticleType } from "./photographer-articles";
import type { FeaturedImage, RecentEssay } from "./recent-essays";
import { TYPE_LABELS } from "@/lib/content-types";

export type RelatedStory = {
  id: string;
  title: string;
  date: string;
  href: string;
  contentTypeLabel: string;
  photographer: string | null;
  featuredImage: FeaturedImage | null;
};

const TYPE_LABEL: Record<PhotographerArticleType, string> = TYPE_LABELS;

/** Must match the homepage ThemeBrowser's per-theme count, so the
 *  request body (and its cache entry) is shared with the homepage. */
const THEME_FIRST = 7;

const fromEssay = (e: RecentEssay): RelatedStory => ({
  id: e.id,
  title: e.title,
  date: e.date,
  href: `/essay/${e.slug}`,
  contentTypeLabel: "Photo Essay",
  photographer: e.photographerName,
  featuredImage: e.featuredImage,
});

/**
 * Related stories for the end of an essay: the same photographer's other
 * work first, then essays sharing its first theme, then recent essays to
 * fill. No new query shapes: both lookups reuse the exact requests the
 * photographer page (photographerWork) and the homepage theme browser
 * (essaysByThemeSlug, first 7) already make, so they hit the same
 * hour-long data cache. The photographer lookup is skipped when the
 * photographer has no other published work, and the theme lookup when
 * the photographer alone fills the strip.
 */
export async function fetchRelatedStories(
  essay: { slug: string; photographers: Photographer[]; themes?: string[] },
  recent: RecentEssay[],
  limit = 6,
): Promise<RelatedStory[]> {
  const out: RelatedStory[] = [];
  const seen = new Set<string>([`/essay/${essay.slug}`]);
  const add = (s: RelatedStory) => {
    if (out.length >= limit || seen.has(s.href) || !s.featuredImage) return;
    seen.add(s.href);
    out.push(s);
  };

  const lead = essay.photographers.find((p) => p.articleCount > 1);
  if (lead) {
    const work = await fetchPhotographerArticles(lead.slug).catch(() => null);
    for (const a of work?.articles ?? []) {
      add({
        id: a.id,
        title: a.title,
        date: a.date,
        href: `/${a.contentType}/${a.slug}`,
        contentTypeLabel: TYPE_LABEL[a.contentType],
        photographer: lead.name,
        featuredImage: a.featuredImage,
      });
    }
  }

  const theme = essay.themes?.[0];
  if (out.length < limit && theme) {
    const byTheme = await fetchEssaysByTheme(theme, THEME_FIRST).catch(() => []);
    byTheme.forEach((e) => add(fromEssay(e)));
  }

  if (out.length < 4) recent.forEach((e) => add(fromEssay(e)));
  return out;
}
