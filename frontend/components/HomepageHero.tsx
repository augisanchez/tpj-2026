import Link from "next/link";
import { ContentTypeChip } from "./ContentTypeChip";
import { TpjImage } from "./TpjImage";
import styles from "./HomepageHero.module.css";

type Props = {
  href: string;
  /** Curatorial label shown in the chip — "Latest Photo Essay",
   *  "From the Archive", "Staff Pick", etc. Replaces the raw content
   *  type so each carousel slide tells the visitor why this is here. */
  contentTypeLabel: string;
  title: string;
  date?: string;
  excerpt?: string;
  photographerName?: string | null;
  backgroundImage?: { src: string; alt: string };
};

export function HomepageHero({
  href,
  contentTypeLabel,
  title,
  date,
  excerpt,
  photographerName,
  backgroundImage,
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
      ? `Photographs by ${photographerName}  ·  ${formattedDate}`
      : photographerName
        ? `Photographs by ${photographerName}`
        : formattedDate;

  return (
    <div className={styles.outer}>
      <Link href={href} className={styles.card}>
        {backgroundImage && (
          <TpjImage
            src={backgroundImage.src}
            alt={backgroundImage.alt}
            sizes="100vw"
            priority
            className={styles.image}
          />
        )}
        <div className={styles.gradient} aria-hidden="true" />
        <div className={styles.stack}>
          <ContentTypeChip label={contentTypeLabel} size="large" />
          <h1 className={styles.title}>{title}</h1>
          {excerpt && <p className={styles.subtitle}>{excerpt}</p>}
          {byline && <p className={styles.byline}>{byline}</p>}
        </div>
      </Link>
    </div>
  );
}
