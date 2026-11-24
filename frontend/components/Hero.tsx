import { ContentTypeChip } from "./ContentTypeChip";
import { TpjImage } from "./TpjImage";
import { WallLabel } from "./WallLabel";
import styles from "./Hero.module.css";

type Props = {
  contentTypeLabel: string;
  title: string;
  subtitle?: string;
  /** Small credit line set above the title, e.g. "Photographs by …". */
  byline?: string;
  /** Secondary credit under the title, e.g. the interview portrait credit. */
  credit?: string | null;
  backgroundImage?: { src: string; alt: string; width?: number; height?: number };
  /** Museum wall label under the lead image. */
  wallLabel?: { photographer?: string | null; year?: number | null; count: number };
};

/**
 * Exhibition scale by title length: short titles run at full size, longer
 * ones step down so they never need more lines than the card can hold.
 * The CSS also caps the size so the longest word always fits the width.
 */
function titleScale(title: string): "xl" | "l" | "m" | "s" {
  const n = title.trim().length;
  if (n <= 24) return "xl";
  if (n <= 40) return "l";
  if (n <= 64) return "m";
  return "s";
}

/** Longest word in "lowercase character widths"; capitals and wide
 *  glyphs (M, W) count extra so an all-caps word still fits. */
function longestWord(title: string): number {
  const width = (w: string) =>
    [...w].reduce((sum, c) => sum + (/[MWmw]/.test(c) ? 1.5 : /[A-Z0-9]/.test(c) ? 1.3 : 1), 0);
  return Math.max(4, ...title.trim().split(/\s+/).map((w) => Math.ceil(width(w))));
}

export function Hero({
  contentTypeLabel,
  title,
  subtitle,
  byline,
  credit,
  backgroundImage,
  wallLabel,
}: Props) {
  return (
    <div className={styles.outer}>
      <div className={styles.card} data-reveal="wipe">
        {backgroundImage && (
          <TpjImage
            className={styles.image}
            src={backgroundImage.src}
            alt={backgroundImage.alt}
            sizes="100vw"
            width={backgroundImage.width}
            priority
          />
        )}
        <div className={styles.gradient} aria-hidden="true" />
        <div className={styles.stack}>
          <div className={styles.eyebrowRow} data-reveal>
            <ContentTypeChip label={contentTypeLabel} size="large" />
            {byline && <p className={styles.byline}>{byline}</p>}
          </div>
          <h1
            className={styles.title}
            data-scale={titleScale(title)}
            style={{ ["--lw" as string]: longestWord(title) }}
            data-reveal="lines"
          >
            {title}
          </h1>
          {subtitle && <p className={styles.subtitle} data-reveal>{subtitle}</p>}
          {credit && <p className={`${styles.byline} ${styles.portraitCredit}`} data-reveal>{credit}</p>}
        </div>
      </div>
      {wallLabel && (
        <WallLabel
          photographer={wallLabel.photographer}
          title={title}
          year={wallLabel.year}
          count={wallLabel.count}
        />
      )}
    </div>
  );
}
