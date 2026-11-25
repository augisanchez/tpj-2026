"use client";

import Link from "./SmartLink";
import { ContentTypeChip, type ContentTypeChipSize } from "./ContentTypeChip";
import { ThemeThumbnail } from "./ThemeThumbnail";
import { capWidths, cdnImageUrl, cdnSrcSet, capDensity, cdnPlaceholderUrl } from "@/lib/cdn";
import styles from "./ArticleCard.module.css";
import { creditFor } from "@/lib/credit";

// Rendered card widths per layout, so the browser picks the right srcset size.
const CARD_SIZES: Record<string, string> = {
  "1up": "(min-width: 768px) 90vw, 100vw",
  "2up": "(min-width: 768px) 45vw, 100vw",
  "3up": "(min-width: 768px) 30vw, 100vw",
  "4up": "(min-width: 1024px) 23vw, (min-width: 768px) 45vw, 100vw",
  "5up": "(min-width: 1024px) 18vw, (min-width: 768px) 45vw, 100vw",
  "6up": "(min-width: 1024px) 15vw, (min-width: 768px) 30vw, 50vw",
};

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
  /** Photographer credit, set as the grey second line of the headline.
   *  Omitted when the card's data source doesn't carry one. */
  photographer?: string | null;
  description?: string;
  featuredImage?: { src: string; alt: string; width?: number; height?: number };
};

type Props = {
  article: Article;
  variant?: ArticleCardVariant;
  /** Overrides the variant's image `sizes` when the grid differs. */
  sizes?: string;
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
  sizes,
  showDate = true,
  compositeImages,
  badgeCount,
}: Props) {
  const hasComposite = Boolean(compositeImages && compositeImages.length > 0);
  const titleClass = `${styles.title} ${styles[`title${variant}` as const]}`;
  const formattedDate = new Date(article.date).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const wrapperClass = styles.imageWrapper;
  const credit = creditFor(article.title, article.photographer);

  return (
    <Link href={article.href} className={styles.card}>
      <div className={styles.imageBlock}>
        <div className={wrapperClass} data-pz>
          {hasComposite ? (
            <div className={`${styles.motionImageScale} pz-media`}>
              <ThemeThumbnail images={compositeImages!} fillParent />
            </div>
          ) : (
            article.featuredImage && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                className={`${styles.image} pz-media`}
                data-fade=""
                src={cdnImageUrl(article.featuredImage.src, { width: Math.min(1024, article.featuredImage.width ?? 1024) }) ?? article.featuredImage.src}
                srcSet={cdnSrcSet(article.featuredImage.src, capWidths([480, 768, 1024, 1440, 1920, 2560], article.featuredImage.width)) ?? undefined}
                sizes={capDensity(sizes ?? CARD_SIZES[variant])}
                data-lqip-src={cdnPlaceholderUrl(article.featuredImage.src) ?? undefined}
                alt={article.featuredImage.alt}
                loading="lazy"
                decoding="async"
              />
            )
          )}
          {typeof badgeCount === "number" && badgeCount > 0 && (
            <span
              className={styles.imageBadge}
              aria-label={`${badgeCount} stories in this collection`}
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
        <h3 className={titleClass}>
          <span className={styles.titleText}>{article.title}</span>
          {credit && (
            <span className={styles.titleCredit}>
              <span className={styles.srOnly}>Photographed by </span>
              {credit}
            </span>
          )}
        </h3>
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
