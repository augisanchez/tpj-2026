import Link from "next/link";
import { Icon } from "./Icon";
import styles from "./RandomBand.module.css";

/**
 * Full-bleed flat band in the day's accent color. The whole band is
 * one link to /random (a redirect to a random article). Not
 * prefetched: a prefetched redirect would pin one "random" pick per
 * page view.
 */
export function RandomBand() {
  return (
    <Link
      href="/random"
      prefetch={false}
      className={styles.band}
      data-reveal
    >
      <span className={styles.line}>
        {/* No-break space: the glyph never wraps onto a line alone. */}
        Show me something{"\u00a0"}
        <span className={styles.badge}>
          <Icon name="shuffle" className={styles.icon} />
        </span>
      </span>
      <span className={styles.note}>
        A random story from everything published since 2012.
      </span>
    </Link>
  );
}
