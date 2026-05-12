import Link from "next/link";
import { ContentTypeChip } from "./ContentTypeChip";
import styles from "./HomepageHero.module.css";

type Props = {
  href: string;
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
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className={styles.image}
            src={backgroundImage.src}
            alt={backgroundImage.alt}
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
