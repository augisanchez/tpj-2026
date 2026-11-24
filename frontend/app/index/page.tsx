import { accentFor } from "@/lib/accent";
import { cdnImageUrl } from "@/lib/cdn";
import { fetchStoryIndex, type StoryType } from "@/lib/queries/story-index";
import { pageMetadata } from "@/lib/seo";
import { StoryIndexList, type IndexRow } from "@/components/StoryIndexList";
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
  const stories = await fetchStoryIndex();
  const oldest = stories[stories.length - 1];
  const { prefix, tails } = compactUrls(
    stories.map((s) => cdnImageUrl(s.image, { width: 480, quality: 80 })),
  );
  const rows: IndexRow[] = stories.map((s, i) => [
    s.no,
    s.title,
    s.photographer ?? "",
    TYPE_CODE[s.type],
    s.year,
    s.slug,
    accentFor(s.slug),
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

      <StoryIndexList rows={rows} prefix={prefix} />
    </div>
  );
}
