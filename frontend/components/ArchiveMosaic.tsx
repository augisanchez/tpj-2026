import Link from "next/link";
import { TpjImage } from "./TpjImage";
import type { ArchiveCounts } from "@/lib/queries/archive-counts";
import styles from "./ArchiveMosaic.module.css";

export type MosaicTile = { href: string; src: string; title: string };

type Props = {
  tiles: MosaicTile[];
  counts: ArchiveCounts;
};

/**
 * A wall of covers drawn from across the archive, then the totals.
 * No heading or copy: the covers and the numbers carry the message.
 * Labels reuse the Explore filter names.
 */
export function ArchiveMosaic({ tiles, counts }: Props) {
  const types = [
    { n: counts.essays, label: "Photo Essays", href: "/explore?type=essay" },
    { n: counts.interviews, label: "Interviews", href: "/explore?type=interview" },
    { n: counts.features, label: "Features", href: "/explore?type=feature" },
    { n: counts.photographers, label: "Photographers", href: "/photographers" },
  ].filter((t) => t.n > 0);

  return (
    <section className={styles.section} aria-label={`${counts.articles} articles`}>
      <ul className={styles.grid}>
        {tiles.map((t) => (
          <li key={t.href} className={styles.cell}>
            <Link href={t.href} className={styles.tile} title={t.title}>
              <TpjImage
                src={t.src}
                alt={t.title}
                sizes="(min-width: 768px) 12.5vw, 25vw"
                maxWidth={400}
                className={styles.image}
              />
            </Link>
          </li>
        ))}
      </ul>

      <div className={styles.totals}>
        <Link href="/explore" className={styles.total}>
          {counts.articles}
        </Link>
        <ul className={styles.types}>
          {types.map((t) => (
            <li key={t.label}>
              <Link href={t.href} className={styles.type}>
                <span className={styles.typeCount}>{t.n}</span>
                {t.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
