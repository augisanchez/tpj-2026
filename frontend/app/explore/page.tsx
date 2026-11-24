import { ExploreGrid } from "@/components/ExploreGrid";
import { fetchExplore } from "@/lib/queries/explore";
import styles from "./page.module.css";

export const metadata = {
  title: "Explore — The Photographic Journal",
  description:
    "Browse the full archive of photo essays, interviews, and features.",
};

const TYPES = ["essay", "interview", "feature"] as const;
type UrlType = (typeof TYPES)[number];

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const [items, params] = await Promise.all([fetchExplore(1000), searchParams]);
  const initialType = TYPES.includes(params.type as UrlType)
    ? (params.type as UrlType)
    : undefined;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title} data-reveal="lines">Explore</h1>
        <p className={styles.lede} data-reveal>
          Every photo essay, interview, and feature published in TPJ since
          2012.
        </p>
      </header>

      <ExploreGrid items={items} initialType={initialType} />
    </main>
  );
}
