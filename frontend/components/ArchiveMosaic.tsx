import Link from "next/link";
import { TpjImage } from "./TpjImage";
import styles from "./ArchiveMosaic.module.css";

export type MosaicTile = {
  href: string;
  src: string;
  title: string;
  photographer: string | null;
};

type Props = {
  tiles: MosaicTile[];
  total: number | null;
};

/**
 * From the Archive: pieces older than two years in a mixed-size grid.
 * The photographer's name sits on every tile; the title shows on hover
 * (and always on the lead tile).
 */
export function ArchiveMosaic({ tiles, total }: Props) {
  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <h2 className={styles.title}>From the Archive</h2>
        <Link href="/explore" className={styles.viewAll}>
          View all{total ? ` ${total}` : ""}
          <span className={styles.arrow} aria-hidden="true">→</span>
        </Link>
      </div>

      <ul className={styles.grid}>
        {tiles.map((t, i) => (
          <li key={t.href} className={`${styles.cell} ${styles[`s${i}`] ?? ""}`}>
            <Link href={t.href} className={styles.tile}>
              <TpjImage
                src={t.src}
                alt={t.title}
                sizes={i === 0 ? "(min-width: 768px) 50vw, 100vw" : "(min-width: 768px) 17vw, 50vw"}
                className={styles.image}
              />
              <span className={styles.caption}>
                {t.photographer && <span className={styles.artist}>{t.photographer}</span>}
                {t.title.trim().toLowerCase() !== (t.photographer ?? "").trim().toLowerCase() && (
                  <span className={styles.piece}>{t.title}</span>
                )}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
