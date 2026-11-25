import Link from "next/link";
import { ArticleCard } from "./ArticleCard";
import type { RelatedStory } from "@/lib/queries/related-stories";
import styles from "./RelatedStrip.module.css";

type Props = {
  label: string;
  stories: RelatedStory[];
};

/** Story cards shown; the row's fourth spot is the submit tile. */
const SHOWN = 3;

/**
 * Related stories at the end of an essay: one row of the same card grid
 * the homepage theme section uses (4 columns, 2 on tablets, 1 on
 * phones), with the site's ArticleCard and the "About the photographer"
 * section label. The strongest matches come first (related-stories.ts),
 * so the row shows the top three, and the fourth spot invites a
 * submission, like the "+79" tile that ends the theme row.
 */
export function RelatedStrip({ label, stories }: Props) {
  // Even with no related stories the invitation still shows.
  return (
    <section className={styles.section} aria-labelledby="related-heading">
      <h2 id="related-heading" className={styles.label} data-reveal>
        {label}
      </h2>
      <ul className={styles.grid} data-reveal-children>
        {stories.slice(0, SHOWN).map((s) => (
          <li key={s.href} className={styles.item}>
            <ArticleCard
              variant="3up"
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
        <li className={styles.item}>
          <Link href="/submit" className={styles.submit}>
            <span className={styles.submitFrame}>
              <span className={styles.submitLine}>
                Send us pix <span aria-hidden="true">→</span>
              </span>
            </span>
            <span className={styles.submitNote}>Let us kibbitz. Make some magic.</span>
          </Link>
        </li>
      </ul>
    </section>
  );
}
