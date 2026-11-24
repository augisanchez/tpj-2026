import { ArticleCard } from "./ArticleCard";
import type { RelatedStory } from "@/lib/queries/related-stories";
import styles from "./RelatedStrip.module.css";

type Props = {
  label: string;
  stories: RelatedStory[];
};

/**
 * Horizontal strip of related stories at the end of an essay. A native
 * scroller (trackpad momentum, touch, keyboard focus all work), with
 * the site's ArticleCard and the "About the photographer" section label.
 */
export function RelatedStrip({ label, stories }: Props) {
  if (stories.length === 0) return null;
  return (
    <section className={styles.section} aria-labelledby="related-heading">
      <h2 id="related-heading" className={styles.label} data-reveal>
        {label}
      </h2>
      <ul className={styles.strip} data-reveal-children>
        {stories.map((s) => (
          <li key={s.href} className={styles.item}>
            <ArticleCard
              variant="5up"
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
