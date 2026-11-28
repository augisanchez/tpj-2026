import type { Photographer } from "@/lib/photographer-types";
import { fetchEssaysByTheme } from "./essays-by-theme";
import { fetchPhotographerArticles, type PhotographerArticle } from "./photographer-articles";
import type { FeaturedImage, RecentEssay } from "./recent-essays";
import { TYPE_LABELS, type ContentType } from "@/lib/content-types";

export type RelatedStory = {
  id: string;
  title: string;
  date: string;
  href: string;
  type: ContentType;
  contentTypeLabel: string;
  photographer: string | null;
  featuredImage: FeaturedImage | null;
};

/** Everything else a credited artist has on TPJ, for the "more" link in
 *  their bio and the first cards of Continue the thread. */
export type ArtistMore = {
  slug: string;
  name: string;
  /** Other stories, newest first: their own work, interviews they
   *  conducted, features they wrote, stories they appear in. Never the
   *  story being read. */
  items: RelatedStory[];
};

/** Must match the homepage ThemeBrowser's per-theme count, so the
 *  request body (and its cache entry) is shared with the homepage. */
const THEME_FIRST = 7;

/** Group pieces can credit a dozen people; look up the first few. */
const MAX_ARTISTS = 6;

/** Cards Continue the thread gives the artist; the rest branch out. */
const ARTIST_SLOTS = 2;

export const fromRecent = (e: RecentEssay, type: ContentType): RelatedStory => ({
  id: e.id,
  title: e.title,
  date: e.date,
  href: `/${type}/${e.slug}`,
  type,
  contentTypeLabel: TYPE_LABELS[type],
  photographer: e.photographerName,
  featuredImage: e.featuredImage,
});

const fromWork = (a: PhotographerArticle, credit: string | null): RelatedStory => ({
  id: a.id,
  title: a.title,
  date: a.date,
  href: `/${a.contentType}/${a.slug}`,
  type: a.contentType,
  contentTypeLabel: TYPE_LABELS[a.contentType],
  photographer: credit,
  featuredImage: a.featuredImage,
});

/**
 * Each credited artist's other stories. Reuses the profile page's own
 * request (photographerWork), so it shares that hour-long cache entry.
 * An artist whose only story is this one comes back with no items, and
 * their bio then shows no profile link.
 */
export async function fetchArtistMore(
  photographers: Photographer[],
  currentHref: string,
): Promise<ArtistMore[]> {
  return Promise.all(
    photographers.slice(0, MAX_ARTISTS).map(async (p) => {
      const work = await fetchPhotographerArticles(p.slug).catch(() => null);
      const seen = new Set<string>([currentHref]);
      const items: RelatedStory[] = [];
      const add = (s: RelatedStory) => {
        if (seen.has(s.href)) return;
        seen.add(s.href);
        items.push(s);
      };
      if (work) {
        work.articles.forEach((a) => add(fromWork(a, p.name)));
        work.interviewsConducted.forEach((a) => add(fromWork(a, null)));
        work.featuresWritten.forEach((a) => add(fromWork(a, null)));
        work.appearsIn.forEach((a) => add(fromWork(a, null)));
      }
      items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      return { slug: p.slug, name: p.name, items };
    }),
  );
}

/**
 * Continue the thread, the same way on every story page: up to two of
 * the artist's other stories (a different kind ahead of the same kind:
 * their interview under an essay, their essays under an interview),
 * alternating with stories sharing the theme, then recent stories.
 * Only stories with a cover photo.
 */
export function buildThread(opts: {
  currentType: ContentType;
  currentHref: string;
  artists: ArtistMore[];
  theme?: RelatedStory[];
  recent: RelatedStory[];
  slots: number;
}): RelatedStory[] {
  const seen = new Set<string>([opts.currentHref]);
  const take = (s: RelatedStory, into: RelatedStory[]) => {
    if (seen.has(s.href) || !s.featuredImage) return false;
    seen.add(s.href);
    into.push(s);
    return true;
  };

  // Artist cards: one from each credited artist in turn, each artist's
  // list ordered other-kind-first, then newest.
  const mine: RelatedStory[] = [];
  const queues = opts.artists.map((a) =>
    [...a.items].sort((x, y) => Number(x.type === opts.currentType) - Number(y.type === opts.currentType)),
  );
  const limit = Math.min(ARTIST_SLOTS, opts.slots);
  while (mine.length < limit && queues.some((q) => q.length)) {
    for (const q of queues) {
      if (mine.length >= limit) break;
      while (q.length && !take(q.shift()!, mine));
    }
  }

  const branch: RelatedStory[] = [];
  for (const s of [...(opts.theme ?? []), ...opts.recent]) {
    if (mine.length + branch.length >= opts.slots) break;
    take(s, branch);
  }

  // Alternate artist and branch cards, so phones (first two cards only)
  // see one of each.
  const out: RelatedStory[] = [];
  while (mine.length || branch.length) {
    if (mine.length) out.push(mine.shift()!);
    if (branch.length) out.push(branch.shift()!);
  }
  return out.slice(0, opts.slots);
}

/** Essays: artist, then the essay's first theme, then recent essays. */
export async function fetchRelatedStories(
  essay: { slug: string; themes?: string[] },
  recent: RecentEssay[],
  artists: ArtistMore[],
  slots = 4,
): Promise<RelatedStory[]> {
  const theme = essay.themes?.[0];
  const byTheme = theme ? await fetchEssaysByTheme(theme, THEME_FIRST).catch(() => []) : [];
  return buildThread({
    currentType: "essay",
    currentHref: `/essay/${essay.slug}`,
    artists,
    theme: byTheme.map((e) => fromRecent(e, "essay")),
    recent: recent.map((e) => fromRecent(e, "essay")),
    slots,
  });
}
