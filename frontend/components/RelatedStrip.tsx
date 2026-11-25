import { ArticleCard } from "./ArticleCard";
import type { RelatedStory } from "@/lib/queries/related-stories";
import styles from "./RelatedStrip.module.css";

type Props = {
  label: string;
  stories: RelatedStory[];
};

/** Cards shown: two rows of two large cards. */
const SHOWN = 4;

/**
 * Related stories at the end of an essay: four large cards, two by two
 * (one column on phones), with the site's ArticleCard and the "About
 * the photographer" section label. The strongest matches come first
 * (related-stories.ts).
 */
export function RelatedStrip({ label, stories }: Props) {
  if (stories.length === 0) return null;
  return (
    <section className={styles.section} aria-labelledby="related-heading">
      <h2 id="related-heading" className={styles.label} data-reveal>
        {label}
      </h2>
      <ul className={styles.grid} data-reveal-children>
        {stories.slice(0, SHOWN).map((s) => (
          <li key={s.href} className={styles.item}>
            <ArticleCard
              variant="2up"
              article={{
                title: s.title,
                date: s.date,
                href: s.href,
                contentTypeLabel: s.contentTypeLabel,
                photographer: s.photographer,
                featuredImage: s.featuredImage ?? undefined,
              }}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
