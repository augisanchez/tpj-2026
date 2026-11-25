import Link from "next/link";
import { TpjImage } from "./TpjImage";
import styles from "./ArchiveMosaic.module.css";

export type MosaicTile = {
  href: string;
  src: string;
  title: string;
  photographer: string | null;
  contentType: "essay" | "interview" | "feature";
  /** Year first published: the green stamp in the tile's corner. */
  year: number | null;
};

const TYPE_LABEL = { essay: "Photo Essay", interview: "Interview", feature: "Feature" } as const;

type Props = {
  tiles: MosaicTile[];
  total: number | null;
};

/**
 * Revisit: pieces older than two years in a mixed-size grid. Every tile
 * shows its main title (the photographer for interviews, the article
 * title otherwise) under a quiet content-type tag, and the year it was
 * published on a signal-green stamp in the corner, so the archive reads
 * as an archive.
 */
export function ArchiveMosaic({ tiles, total }: Props) {
  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <h2 className={styles.title} data-reveal="lines">Revisit</h2>
        <Link href="/explore" className={styles.viewAll} data-reveal>
          View all{total ? ` ${total}` : ""}
          <span className={styles.arrow} aria-hidden="true">→</span>
        </Link>
      </div>

      <ul className={styles.grid} data-reveal-children>
        {tiles.map((t, i) => (
          <li key={t.href} className={`${styles.cell} ${styles[`s${i}`] ?? ""}`}>
            <Link
              href={t.href}
              className={styles.tile}
              data-pz
            >
              <TpjImage
                src={t.src}
                alt={t.title}
                // Lead tiles span half the grid; wide (two columns) and tall
                // (two rows, cropped to fill) tiles need about a third;
                // squares a sixth.
                sizes={
                  i === 0 || i === 14
                    ? "(min-width: 768px) 50vw, 100vw"
                    : [1, 3, 6, 8, 11, 15].includes(i)
                      ? "(min-width: 768px) 34vw, 100vw"
                      : "(min-width: 768px) 17vw, 50vw"
                }
                className={`${styles.image} pz-media`}
              />
              {t.year ? <span className={styles.year}>{t.year}</span> : null}
              <span className={styles.caption}>
                <span className={styles.type}>{TYPE_LABEL[t.contentType]}</span>
                <span className={styles.piece}>
                  {t.contentType === "interview" ? t.photographer || t.title : t.title}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
