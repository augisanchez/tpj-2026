import { ContentTypeChip } from "./ContentTypeChip";
import styles from "./Hero.module.css";

type Props = {
  contentTypeLabel: string;
  title: string;
  subtitle?: string;
  byline?: string;
  backgroundImage?: { src: string; alt: string };
};

export function Hero({
  contentTypeLabel,
  title,
  subtitle,
  byline,
  backgroundImage,
}: Props) {
  return (
    <div className={styles.outer}>
      <div className={styles.card}>
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
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
          {byline && <p className={styles.byline}>{byline}</p>}
        </div>
      </div>
    </div>
  );
}
