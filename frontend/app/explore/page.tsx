import { pageMetadata } from "@/lib/seo";
import { ExploreGrid } from "@/components/ExploreGrid";
import { fetchExplore } from "@/lib/queries/explore";
import styles from "./page.module.css";

export const metadata = pageMetadata({
  title: "Explore — The Photographic Journal",
  description: "Browse the full archive of photo essays, interviews, and features.",
  path: "/explore",
});

// Static (cached) page: the ?type= filter is read in the browser by
// ExploreGrid, so the server never renders per request.
export default async function ExplorePage() {
  const items = await fetchExplore(1000);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title} data-reveal="lines">Explore</h1>
        <p className={styles.lede} data-reveal>
          Every photo essay, interview, and feature published in TPJ since
          2012.
        </p>
      </header>

      <ExploreGrid items={items} />
    </main>
  );
}
