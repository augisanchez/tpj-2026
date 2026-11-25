import { pageMetadata } from "@/lib/seo";
import { cdnImageUrl } from "@/lib/cdn";
import { ExploreGrid, type ExplorePeople } from "@/components/ExploreGrid";
import { fetchExplore } from "@/lib/queries/explore";
import { fetchPhotographersIndex } from "@/lib/queries/photographers-index";
import ih from "@/components/IndexHeader.module.css";
import styles from "./page.module.css";

export const metadata = pageMetadata({
    generatedImage: true,
  title: "Explore — The Photographic Journal",
  description: "Browse the full archive of photo essays, interviews, and features.",
  path: "/explore",
});

// Before first paint, flag a List URL (/explore?view=list, where /index
// now lands) so the server-rendered grid stays hidden until the list
// takes over in the browser. See ExploreGrid.module.css.
const VIEW_FLAG =
  "if(/[?&]view=list(&|$)/.test(location.search))document.documentElement.dataset.exploreView='list'";

// Static (cached) page: the ?type=, ?view= and other filters are read in
// the browser by ExploreGrid, so the server never renders per request.
export default async function ExplorePage() {
  const [items, directory] = await Promise.all([
    fetchExplore(1000),
    // Same cached request as /photographers: only portrait and count are
    // kept, for the List view's photographer cards.
    fetchPhotographersIndex().catch(() => []),
  ]);

  // Only the photographers the stories credit, keyed by profile slug.
  const credited = new Set(items.map((i) => i.photographerSlug).filter(Boolean));
  const people: ExplorePeople = {};
  for (const p of directory) {
    if (!credited.has(p.slug)) continue;
    const portrait = p.portrait ? cdnImageUrl(p.portrait.src, { width: 160, quality: 80 }) : null;
    people[p.slug] = [portrait ?? "", p.articleCount];
  }

  return (
    <div className={styles.page}>
      <header className={ih.intro}>
        <h1 className={ih.title} data-reveal="lines">Explore</h1>
        <p className={ih.lede} data-reveal>
          Every photo essay, interview, and feature published in TPJ since
          2012.
        </p>
      </header>

      <script dangerouslySetInnerHTML={{ __html: VIEW_FLAG }} />
      <ExploreGrid items={items} people={people} />
    </div>
  );
}
