import styles from "./HomepageHeroListing.module.css";

type Props = {
  /** Kind of piece, sentence case: "Photo essay", "Interview", "Feature". */
  medium: string;
  title: string;
  photographerName?: string | null;
  date?: string;
  /** False while the carousel shows another slide: fades out, keeps its space. */
  visible?: boolean;
};

/** WordPress dates carry no zone: read the calendar day as written. */
function formatDate(date: string) {
  return new Date(`${date.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

/**
 * A museum wall label for the latest story: it hangs under the hero
 * frame, beside the work rather than on it.
 *
 *   ON VIEW
 *   Name, Title, 2026
 *   Photo essay · Posted November 3, 2026
 */
export function HomepageHeroListing({
  medium,
  title,
  photographerName,
  date,
  visible = true,
}: Props) {
  const year = date ? date.slice(0, 4) : null;
  return (
    <div className={styles.wrap} data-reveal>
      <p
        className={`${styles.listing}${visible ? "" : " " + styles.hidden}`}
        aria-hidden={visible ? undefined : true}
      >
        <span className={styles.eyebrow}>On view</span>
        <span className={styles.work}>
          {photographerName && (
            <>
              <span className={styles.artist}>{photographerName}</span>
              {", "}
            </>
          )}
          <cite className={styles.title}>{title}</cite>
          {year ? `, ${year}` : null}
        </span>
        <span className={styles.meta}>
          {medium}
          {date ? ` · Posted ${formatDate(date)}` : null}
        </span>
      </p>
    </div>
  );
}
