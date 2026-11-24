import Link from "next/link";
import styles from "./RandomBand.module.css";

/**
 * Oldest published piece in the archive: the Lou Noble interview,
 * 2012-10-25 (checked against the CMS, ordered by date ascending).
 * The band's year count is derived from it so it stays true as time
 * passes.
 */
const OLDEST_ARTICLE_DATE = Date.UTC(2012, 9, 25);
const MS_PER_YEAR = 365.2425 * 24 * 60 * 60 * 1000;

function journalYears() {
  return Math.floor((Date.now() - OLDEST_ARTICLE_DATE) / MS_PER_YEAR);
}

/**
 * Full-bleed flat band in the day's accent color. The whole band is
 * one link to /random (a redirect to a random article). Not
 * prefetched: a prefetched redirect would pin one "random" pick per
 * page view.
 */
export function RandomBand() {
  const years = journalYears();
  return (
    <Link
      href="/random"
      prefetch={false}
      className={styles.band}
      data-reveal
    >
      <span className={styles.line}>
        Show me something{" "}
        <span className={styles.arrow} aria-hidden="true">
          →
        </span>
      </span>
      <span className={styles.note}>
        A random story from {years} years of the journal.
      </span>
    </Link>
  );
}
