"use client";

import Link from "next/link";
import { useState } from "react";
import { ContentTypeChip, type ContentTypeChipSize } from "./ContentTypeChip";
import { ThemeThumbnail } from "./ThemeThumbnail";
import styles from "./ArticleCard.module.css";

export type ArticleCardVariant =
  | "1up"
  | "2up"
  | "3up"
  | "4up"
  | "5up"
  | "6up";

type Article = {
  title: string;
  date: string;
  href: string;
  contentTypeLabel: string;
  description?: string;
  featuredImage?: { src: string; alt: string };
};

type Props = {
  article: Article;
  variant?: ArticleCardVariant;
  showDate?: boolean;
  /**
   * Composite thumbnail mode: when provided, render a 2×2
   * collection-of-images instead of the single featuredImage. Used
   * on Theme cards in Dive Deeper so the card reads as a
   * collection at a glance (Spotify-playlist treatment).
   */
  compositeImages?: { src: string; alt: string }[];
  /**
   * Article count badge rendered in the bottom-right of the image.
   * Use on collection cards (Themes) to reinforce that the link
   * leads to a grouping. Hidden when undefined or non-positive.
   */
  badgeCount?: number;
};

const CHIP_SIZE_BY_VARIANT: Record<ArticleCardVariant, ContentTypeChipSize> = {
  "1up": "large",
  "2up": "large",
  "3up": "medium",
  "4up": "medium",
  "5up": "medium",
  "6up": "small",
};

export function ArticleCard({
  article,
  variant = "4up",
  showDate = true,
  compositeImages,
  badgeCount,
}: Props) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const hasComposite = Boolean(compositeImages && compositeImages.length > 0);
  const hasImage = Boolean(article.featuredImage);
  const titleClass = `${styles.title} ${styles[`title${variant}` as const]}`;
  const formattedDate = new Date(article.date).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const wrapperClass = `${styles.imageWrapper}${
    hasImage && !imageLoaded && !hasComposite
      ? " " + styles.imageWrapperLoading
      : ""
  }`;

  return (
    <Link href={article.href} className={styles.card}>
      <div className={styles.imageBlock}>
        <div className={wrapperClass}>
          {hasComposite ? (
            <ThemeThumbnail images={compositeImages!} fillParent />
          ) : (
            article.featuredImage && (
              <img
                className={`${styles.image}${imageLoaded ? " " + styles.imageLoaded : ""}`}
                src={article.featuredImage.src}
                alt={article.featuredImage.alt}
                loading="lazy"
                onLoad={() => setImageLoaded(true)}
                onError={() => setImageLoaded(true)}
              />
            )
          )}
          {typeof badgeCount === "number" && badgeCount > 0 && (
            <span
              className={styles.imageBadge}
              aria-label={`${badgeCount} articles in this collection`}
            >
              {badgeCount}
            </span>
          )}
        </div>
      </div>
      <div className={styles.textStack}>
        <ContentTypeChip
          label={article.contentTypeLabel}
          size={CHIP_SIZE_BY_VARIANT[variant]}
        />
        <h3 className={titleClass}>{article.title}</h3>
        {article.description && (
          <p className={styles.description}>{article.description}</p>
        )}
        {showDate && (
          <time className={styles.date} dateTime={article.date}>
            {formattedDate}
          </time>
        )}
      </div>
    </Link>
  );
}
