import { ViewTransition } from "react";
import { ContentTypeChip } from "./ContentTypeChip";
import styles from "./Hero.module.css";

type Props = {
  contentTypeLabel: string;
  title: string;
  subtitle?: string;
  byline?: string;
  backgroundImage?: { src: string; alt: string };
  /**
   * Optional shared-element name. When set and a card on the previous
   * page wrapped its image with the same name, the browser morphs that
   * thumbnail into this hero image on navigation.
   */
  transitionName?: string;
};

export function Hero({
  contentTypeLabel,
  title,
  subtitle,
  byline,
  backgroundImage,
  transitionName,
}: Props) {
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
      <div className={styles.card}>
        {imageEl && transitionName ? (
          <ViewTransition name={transitionName}>{imageEl}</ViewTransition>
        ) : (
          imageEl
        )}
        <div className={styles.gradient} aria-hidden="true" />
        <div className={styles.stack}>
          <ContentTypeChip label={contentTypeLabel} size="large" />
          <h1 className={styles.title}>{title}</h1>
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
          {byline && <p className={styles.byline}>{byline}</p>}
        </div>
      </div>
    </div>
  );
}
