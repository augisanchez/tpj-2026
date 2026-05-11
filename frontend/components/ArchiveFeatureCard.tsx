import Link from "next/link";
import { ContentTypeChip } from "./ContentTypeChip";
import type { ArchiveFeature } from "@/lib/queries/archive-feature";
import styles from "./ArchiveFeatureCard.module.css";

type Props = {
  feature: ArchiveFeature;
};

const TYPE_LABEL: Record<ArchiveFeature["type"], string> = {
  essay: "Essay",
  interview: "Interview",
  feature: "Feature",
};

const READ_LABEL: Record<ArchiveFeature["type"], string> = {
  essay: "Read essay",
  interview: "Read interview",
  feature: "Read feature",
};

export function ArchiveFeatureCard({ feature }: Props) {
  const year = new Date(feature.date).getFullYear();

  return (
    <Link href={feature.href} className={styles.card}>
      <span className={styles.imageWrapper}>
        {feature.featuredImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className={styles.image}
            src={feature.featuredImage.src}
            alt={feature.featuredImage.alt}
          />
        )}
      </span>
      <span className={styles.text}>
        <ContentTypeChip label="From the Archive" size="medium" />
        <h2 className={styles.title}>{feature.title}</h2>
        <p className={styles.meta}>
          {year}
          <span className={styles.metaDot} aria-hidden="true">
            ·
          </span>
          {TYPE_LABEL[feature.type]}
        </p>
        {feature.excerpt && <p className={styles.excerpt}>{feature.excerpt}</p>}
        <span className={styles.spacer} aria-hidden="true" />
        <span className={styles.cta}>
          {READ_LABEL[feature.type]}
          <span className={styles.ctaArrow} aria-hidden="true">
            →
          </span>
        </span>
      </span>
    </Link>
  );
}
