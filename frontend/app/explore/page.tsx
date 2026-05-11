import { ExploreGrid } from "@/components/ExploreGrid";
import { fetchExplore } from "@/lib/queries/explore";
import styles from "./page.module.css";

export const metadata = {
  title: "Explore — The Photographic Journal",
  description:
    "Browse the full archive of photo essays, interviews, and features.",
};

export default async function ExplorePage() {
  const items = await fetchExplore(1000);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Explore</h1>
        <p className={styles.lede}>
          Every photo essay, interview, and feature published in TPJ since
          2012.
        </p>
        <p className={styles.count}>
          {items.length} pieces in the archive
        </p>
      </header>

      <ExploreGrid items={items} />
    </main>
  );
}
