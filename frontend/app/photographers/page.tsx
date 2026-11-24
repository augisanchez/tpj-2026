import { pageMetadata } from "@/lib/seo";
import { EmptyState } from "@/components/EmptyState";
import { PhotographersFilters } from "@/components/PhotographersFilters";
import { fetchPhotographersIndex } from "@/lib/queries/photographers-index";
import ih from "@/components/IndexHeader.module.css";
import styles from "@/components/PhotographersIndex.module.css";

export const metadata = pageMetadata({
  title: "Photographers — The Photographic Journal",
  description: "Every photographer published in The Photographic Journal.",
  path: "/photographers",
});

export default async function PhotographersIndexPage() {
  const photographers = await fetchPhotographersIndex();

  return (
    <div className={styles.page}>
      <header className={`${ih.intro} ${styles.intro}`}>
        <h1 className={ih.title} data-reveal="lines">Photographers</h1>
        <p className={ih.lede} data-reveal>
          Every photographer who has appeared in TPJ since 2012.
        </p>
      </header>

      {photographers.length === 0 ? (
        <div className={styles.empty}>
          <EmptyState
            heading="The photographer index hasn’t been populated yet."
            note="Run wp tpj migrate-photographers to import from the archive."
          />
        </div>
      ) : (
        <PhotographersFilters photographers={photographers} />
      )}
    </div>
  );
}
