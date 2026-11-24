"use client";

import Link from "next/link";
import { ContentTypeChip } from "./ContentTypeChip";
import { TpjImage } from "./TpjImage";
import styles from "./HomepageHero.module.css";

type Props = {
  href: string;
  /** Curatorial label shown in the chip — "Latest Photo Essay",
   *  "Revisit", "Featured Photographer", etc. Replaces the raw content
   *  type so each carousel slide tells the visitor why this is here. */
  contentTypeLabel: string;
  title: string;
  date?: string;
  excerpt?: string;
  photographerName?: string | null;
  /** Credit wording before the name. "Photographs by" by default; features use "By". */
  creditPrefix?: string;
  backgroundImage?: { src: string; alt: string };
  /** CSS object-position for the image, e.g. "50% 25%" to keep a face in frame. */
  imageFocus?: string;
  /** Fill a parent frame (carousel) instead of drawing its own rounded card. */
  fill?: boolean;
  /** Only the first slide's image should load eagerly. */
  priority?: boolean;
};

export function HomepageHero({
  href,
  contentTypeLabel,
  title,
  date,
  excerpt,
  photographerName,
  creditPrefix = "Photographs by",
  backgroundImage,
  imageFocus,
  fill = false,
  priority = true,
}: Props) {
  const formattedDate = date
    ? new Date(date).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;
  const byline =
    photographerName && formattedDate
      ? `${creditPrefix} ${photographerName}  ·  ${formattedDate}`
      : photographerName
        ? `${creditPrefix} ${photographerName}`
        : formattedDate;

  return (
    <div className={fill ? styles.fillOuter : styles.outer}>
      <Link
        href={href}
        className={`${styles.card}${fill ? " " + styles.fillCard : ""}`}
        data-pz
        style={{ "--pz-range": "1%" } as React.CSSProperties}
      >
        {backgroundImage && (
          <div
            className={`${styles.imageWrap} pz-media`}
            style={imageFocus ? ({ "--hero-focus": imageFocus } as React.CSSProperties) : undefined}
          >
            <TpjImage
              src={backgroundImage.src}
              alt={backgroundImage.alt}
              sizes="100vw"
              priority={priority}
              className={styles.image}
            />
          </div>
        )}
        <div className={styles.gradient} aria-hidden="true" />
        <div className={styles.stack}>
          <div data-reveal>
            <ContentTypeChip label={contentTypeLabel} size="large" />
          </div>
          <h1 className={styles.title} data-reveal="lines">{title}</h1>
          {excerpt && <p className={styles.subtitle} data-reveal>{excerpt}</p>}
          {byline && <p className={styles.byline} data-reveal>{byline}</p>}
        </div>
      </Link>
    </div>
  );
}
