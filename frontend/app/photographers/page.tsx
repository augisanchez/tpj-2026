import { EmptyState } from "@/components/EmptyState";
import { PhotographersFilters } from "@/components/PhotographersFilters";
import { fetchPhotographersIndex } from "@/lib/queries/photographers-index";
import styles from "@/components/PhotographersIndex.module.css";

export const metadata = {
  title: "Photographers — The Photographic Journal",
  description: "Every photographer published in The Photographic Journal.",
};

export default async function PhotographersIndexPage() {
  const photographers = await fetchPhotographersIndex();

  return (
    <div className={styles.page}>
      <header className={styles.intro}>
        <p className={styles.eyebrow}>Photographer</p>
        <h1 className={styles.title}>Photographers</h1>
        <p className={styles.lede}>
          Every photographer who has appeared in TPJ over the past thirteen
          years.
        </p>
        {photographers.length > 0 && (
          <p className={styles.summary}>
            {photographers.length}{" "}
            {photographers.length === 1 ? "photographer" : "photographers"}
          </p>
        )}
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
