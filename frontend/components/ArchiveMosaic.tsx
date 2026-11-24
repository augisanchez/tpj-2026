import Link from "next/link";
import { TpjImage } from "./TpjImage";
import styles from "./ArchiveMosaic.module.css";

export type MosaicTile = {
  href: string;
  src: string;
  title: string;
  photographer: string | null;
  contentType: "essay" | "interview" | "feature";
};

const TYPE_LABEL = { essay: "Photo Essay", interview: "Interview", feature: "Feature" } as const;

type Props = {
  tiles: MosaicTile[];
  total: number | null;
};

/**
 * Revisit: pieces older than two years in a mixed-size grid. Every tile
 * shows its main title (the photographer for interviews, the article
 * title otherwise) under a quiet content-type tag.
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
                sizes={i === 0 || i === 14 ? "(min-width: 768px) 50vw, 100vw" : "(min-width: 768px) 17vw, 50vw"}
                className={`${styles.image} pz-media`}
              />
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
