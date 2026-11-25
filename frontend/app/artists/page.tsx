import { pageMetadata } from "@/lib/seo";
import { EmptyState } from "@/components/EmptyState";
import { PhotographersFilters } from "@/components/PhotographersFilters";
import { fetchPhotographersIndex } from "@/lib/queries/photographers-index";
import ih from "@/components/IndexHeader.module.css";
import styles from "@/components/PhotographersIndex.module.css";

export const metadata = pageMetadata({
    generatedImage: true,
  title: "Artists — The Photographic Journal",
  description: "Every photographer, writer and interviewer published in The Photographic Journal since 2012.",
  path: "/artists",
});

export default async function ArtistsIndexPage() {
  const photographers = await fetchPhotographersIndex();

  return (
    <div className={styles.page}>
      <header className={`${ih.intro} ${styles.intro}`}>
        <h1 className={ih.title} data-reveal="lines">Artists</h1>
        <p className={ih.lede} data-reveal>
          Everyone whose work has run in TPJ since 2012: photographers, writers and interviewers.
        </p>
      </header>

      {photographers.length === 0 ? (
        <div className={styles.empty}>
          <EmptyState
            heading="The artist index hasn’t been populated yet."
            note="Run wp tpj migrate-photographers to import from the archive."
          />
        </div>
      ) : (
        <PhotographersFilters photographers={photographers} />
      )}
    </div>
  );
}
