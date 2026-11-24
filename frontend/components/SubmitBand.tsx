import Link from "next/link";
import styles from "./SubmitBand.module.css";

/**
 * End-of-essay invitation to submit. Same pattern as the homepage
 * RandomBand: one full-bleed flat acid band, ink type, the whole band
 * one link. Copy is the Submit page's own ("Send us pix, let us
 * kibbitz, make some magic").
 */
export function SubmitBand() {
  return (
    <Link href="/submit" className={styles.band} data-reveal>
      <span className={styles.line}>
        Send us pix{" "}
        <span className={styles.arrow} aria-hidden="true">
          →
        </span>
      </span>
      <span className={styles.note}>Let us kibbitz. Make some magic.</span>
    </Link>
  );
}
