"use client";

import Link from "next/link";
import { useState, ViewTransition } from "react";
import { ContentTypeChip, type ContentTypeChipSize } from "./ContentTypeChip";
import styles from "./ArticleCard.module.css";

// Build a stable view-transition name from a "/type/slug" href so this
// card's image can morph into the destination Hero's image on click.
// Returns null for non-article hrefs (e.g. /photographer/...) so they
// don't pollute the article-image namespace.
function articleImageTransitionName(href: string): string | null {
  const m = href.match(/^\/(essay|interview|feature)\/([^/?#]+)/);
  return m ? `article-image-${m[1]}-${m[2]}` : null;
}

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
}: Props) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const hasImage = Boolean(article.featuredImage);
  const titleClass = `${styles.title} ${styles[`title${variant}` as const]}`;
  const formattedDate = new Date(article.date).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const wrapperClass = `${styles.imageWrapper}${
    hasImage && !imageLoaded ? " " + styles.imageWrapperLoading : ""
  }`;

  const morphName = articleImageTransitionName(article.href);
  const imageEl = article.featuredImage && (
    <img
      className={`${styles.image}${imageLoaded ? " " + styles.imageLoaded : ""}`}
      src={article.featuredImage.src}
      alt={article.featuredImage.alt}
      loading="lazy"
      onLoad={() => setImageLoaded(true)}
      onError={() => setImageLoaded(true)}
    />
  );

  return (
    <Link href={article.href} className={styles.card}>
      <div className={wrapperClass}>
        {imageEl && morphName ? (
          <ViewTransition name={morphName}>{imageEl}</ViewTransition>
        ) : (
          imageEl
        )}
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
