import { PhotographerListCard } from "./PhotographerListCard";
import type { Photographer } from "@/lib/photographer-types";
import styles from "./AboutPhotographerSection.module.css";

type Props = {
  /** Single photographer (legacy callers / homepage spotlight). */
  photographer?: Photographer;
  /** Multiple photographers — collaborations render one card each. */
  photographers?: Photographer[];
  eyebrow?: string;
};

/**
 * "About the photographer" block at the end of an article. Renders the
 * directory-style PhotographerListCard so the article-end credit
 * matches the photographers index visually. Collaborations get one
 * card per contributor with a pluralized eyebrow.
 */
export function AboutPhotographerSection({
  photographer,
  photographers,
  eyebrow,
}: Props) {
  const list =
    photographers && photographers.length > 0
      ? photographers
      : photographer
        ? [photographer]
        : [];

  if (list.length === 0) return null;

  const label =
    eyebrow ??
    (list.length > 1 ? "About the photographers" : "About the photographer");

  return (
    <section className={styles.section}>
      <p className={styles.eyebrow}>{label}</p>
      <div className={styles.cards}>
        {list.map((p) => (
          <PhotographerListCard
            key={p.slug}
            name={p.name}
            slug={p.slug}
            articleCount={p.articleCount}
            portrait={p.portrait}
            centered
            compact
          />
        ))}
      </div>
    </section>
  );
}
