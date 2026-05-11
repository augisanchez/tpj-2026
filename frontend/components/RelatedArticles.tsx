import { ArticleCard } from "./ArticleCard";
import type { RecentEssay } from "@/lib/queries/recent-essays";
import styles from "./RelatedArticles.module.css";

type Props = {
  eyebrow?: string;
  heading?: string;
  essays: RecentEssay[];
  /** The chip label and href base used for every card. */
  contentTypeLabel?: string;
  hrefBase?: string;
};

export function RelatedArticles({
  eyebrow = "More from TPJ",
  heading = "Continue the thread",
  essays,
  contentTypeLabel = "Photo Essay",
  hrefBase = "/essay",
}: Props) {
  if (essays.length === 0) return null;

  return (
    <section className={styles.section}>
      <div className={styles.headerStack}>
        <p className={styles.eyebrow}>{eyebrow}</p>
        <h2 className={styles.heading}>{heading}</h2>
      </div>

      <div className={styles.grid}>
        {essays.slice(0, 3).map((essay) => (
          <ArticleCard
            key={essay.id}
            variant="5up"
            article={{
              title: essay.title,
              date: essay.date,
              href: `${hrefBase}/${essay.slug}`,
              contentTypeLabel,
              featuredImage: essay.featuredImage ?? undefined,
            }}
          />
        ))}
      </div>
    </section>
  );
}
