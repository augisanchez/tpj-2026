import { ContentTypeChip } from "./ContentTypeChip";
import { TpjImage } from "./TpjImage";
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
      <div className={styles.card} data-reveal="wipe">
        {backgroundImage && (
          <TpjImage
            className={styles.image}
            src={backgroundImage.src}
            alt={backgroundImage.alt}
            sizes="100vw"
            priority
          />
        )}
        <div className={styles.gradient} aria-hidden="true" />
        <div className={styles.stack}>
          <div data-reveal>
            <ContentTypeChip label={contentTypeLabel} size="large" />
          </div>
          <h1 className={styles.title} data-reveal="lines">{title}</h1>
          {subtitle && <p className={styles.subtitle} data-reveal>{subtitle}</p>}
          {byline && <p className={styles.byline} data-reveal>{byline}</p>}
        </div>
      </div>
    </div>
  );
}
