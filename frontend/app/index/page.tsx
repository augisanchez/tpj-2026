import { cdnImageUrl } from "@/lib/cdn";
import { fetchStoryIndex, type StoryType } from "@/lib/queries/story-index";
import { fetchPhotographersIndex } from "@/lib/queries/photographers-index";
import { slugifyName } from "@/lib/text-utils";
import { pageMetadata } from "@/lib/seo";
import {
  StoryIndexList,
  type IndexPerson,
  type IndexRow,
} from "@/components/StoryIndexList";
import styles from "@/components/StoryIndex.module.css";

export const metadata = pageMetadata({
  title: "Index — The Photographic Journal",
  description:
    "Every photo essay, interview and feature The Photographic Journal has published, numbered in the order it ran.",
  path: "/index",
});

// Static, rebuilt at most hourly from the cached story list.
export const revalidate = 3600;

const TYPE_CODE: Record<StoryType, IndexRow[3]> = { essay: 0, interview: 1, feature: 2 };

/** Split thumbnail URLs into one shared prefix plus short tails, so the
 *  client gets ~30 bytes per story instead of a full CDN URL. */
function compactUrls(urls: (string | null)[]) {
  const present = urls.filter((u): u is string => !!u);
  let prefix = present[0] ?? "";
  for (const u of present) {
    let i = 0;
    while (i < prefix.length && i < u.length && prefix[i] === u[i]) i++;
    prefix = prefix.slice(0, i);
    if (!prefix) break;
  }
  return { prefix, tails: urls.map((u) => (u ? u.slice(prefix.length) : "")) };
}

export default async function IndexPage() {
  const [stories, directory] = await Promise.all([
    fetchStoryIndex(),
    // Same cached request as /photographers; only portrait and count are kept.
    fetchPhotographersIndex().catch(() => []),
  ]);
  const oldest = stories[stories.length - 1];
  const { prefix, tails } = compactUrls(
    stories.map((s) => cdnImageUrl(s.image, { width: 800, quality: 80 })),
  );

  // Linked credits become one entry per photographer (rows point at it
  // by number), so a name repeated across stories ships once.
  const bySlug = new Map(directory.map((p) => [p.slug, p]));
  const personIndex = new Map<string, number>();
  const people: { name: string; slug: string; portrait: string | null; count: number }[] = [];
  const credit = stories.map((s): string | number => {
    if (!s.photographer) return "";
    if (!s.photographerSlug) return s.photographer;
    let i = personIndex.get(s.photographerSlug);
    if (i === undefined) {
      const entry = bySlug.get(s.photographerSlug);
      i = people.length;
      personIndex.set(s.photographerSlug, i);
      people.push({
        name: s.photographer,
        slug: s.photographerSlug,
        portrait: entry?.portrait
          ? cdnImageUrl(entry.portrait.src, { width: 160, quality: 80 })
          : null,
        count: entry?.articleCount ?? 0,
      });
    }
    return i;
  });
  const portraits = compactUrls(people.map((p) => p.portrait));
  const persons: IndexPerson[] = people.map((p, i) => [
    p.name,
    // Most slugs are the name, slugified; only the exceptions ship.
    slugifyName(p.name) === p.slug ? "" : p.slug,
    portraits.tails[i],
    p.count,
  ]);

  const rows: IndexRow[] = stories.map((s, i) => [
    s.no,
    s.title,
    credit[i],
    TYPE_CODE[s.type],
    s.year,
    s.slug,
    tails[i],
  ]);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title} data-reveal="lines">
          Index
        </h1>
        <p className={styles.lede} data-reveal>
          Every story we have published, numbered in the order it ran.
          {oldest ? ` No. 1 went up in ${oldest.year}.` : ""} The numbers only go up.
        </p>
      </header>

      <div className={styles.cols} aria-hidden="true">
        <span>No.</span>
        <span>Title</span>
        <span>Photographer</span>
        <span>Type</span>
        <span>Year</span>
      </div>

      <StoryIndexList
        rows={rows}
        prefix={prefix}
        persons={persons}
        portraitPrefix={portraits.prefix}
      />
    </div>
  );
}
