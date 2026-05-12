import Link from "next/link";
import { ViewTransition } from "react";
import { ContentTypeChip } from "./ContentTypeChip";
import styles from "./HomepageHero.module.css";

function articleImageTransitionName(href: string): string | null {
  const m = href.match(/^\/(essay|interview|feature)\/([^/?#]+)/);
  return m ? `article-image-${m[1]}-${m[2]}` : null;
}

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

  const morphName = articleImageTransitionName(href);
  const imageEl = backgroundImage && (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className={styles.image}
      src={backgroundImage.src}
      alt={backgroundImage.alt}
    />
  );

  return (
    <div className={styles.outer}>
      <Link href={href} className={styles.card}>
        {imageEl && morphName ? (
          <ViewTransition name={morphName}>{imageEl}</ViewTransition>
        ) : (
          imageEl
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
