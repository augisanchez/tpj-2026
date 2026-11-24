"use client";

import Link from "next/link";
import { ContentTypeChip, type ContentTypeChipSize } from "./ContentTypeChip";
import { ThemeThumbnail } from "./ThemeThumbnail";
import { capWidths, cdnImageUrl, cdnSrcSet } from "@/lib/cdn";
import { accentFor } from "@/lib/accent";
import styles from "./ArticleCard.module.css";

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
  description?: string;
  featuredImage?: { src: string; alt: string; width?: number; height?: number };
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

const DAY_MS = 24 * 60 * 60 * 1000;
const NEW_WITHIN_MS = 30 * DAY_MS;
const ARCHIVE_AFTER_MS = 5 * 365.2425 * DAY_MS;

/**
 * Start of today (UTC). Day granularity keeps the server render and the
 * client's hydration on the same answer except across a UTC midnight.
 */
function today(): number {
  const now = Date.now();
  return now - (now % DAY_MS);
}

type Status = { kind: "new" } | { kind: "archive" } | null;

/** "New" inside 30 days of posting, "From the archive" past five years. */
function statusFor(date: string, now: number): Status {
  const posted = new Date(date).getTime();
  if (Number.isNaN(posted)) return null;
  const age = now - posted;
  if (age >= 0 && age <= NEW_WITHIN_MS) return { kind: "new" };
  if (age > ARCHIVE_AFTER_MS) return { kind: "archive" };
  return null;
}

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
  const hasComposite = Boolean(compositeImages && compositeImages.length > 0);
  const titleClass = `${styles.title} ${styles[`title${variant}` as const]}`;
  const formattedDate = new Date(article.date).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const wrapperClass = styles.imageWrapper;
  // Collection cards (composite thumbnails) aren't single stories.
  const status = showDate && !hasComposite ? statusFor(article.date, today()) : null;

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
                sizes={CARD_SIZES[variant]}
                alt={article.featuredImage.alt}
                loading="lazy"
                decoding="async"
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
        <div className={styles.metaRow}>
          <ContentTypeChip
            label={article.contentTypeLabel}
            size={CHIP_SIZE_BY_VARIANT[variant]}
          />
          {status?.kind === "new" && (
            <span
              className={`${styles.status} ${styles.statusNew} ${styles[`status${CHIP_SIZE_BY_VARIANT[variant]}` as const]}`}
              data-accent={accentFor(article.href)}
            >
              New
            </span>
          )}
        </div>
        <h3 className={titleClass}>
          <span className={styles.titleText}>{article.title}</span>
        </h3>
        {article.description && (
          <p className={styles.description}>{article.description}</p>
        )}
        {showDate && (
          // Archive pieces label the date line, so the label costs no
          // extra line and every card in a row keeps the same height.
          <p className={styles.date}>
            {status?.kind === "archive" && (
              <>
                <span className={styles.statusArchive}>From the archive</span>
                {" · "}
              </>
            )}
            <time dateTime={article.date}>{formattedDate}</time>
          </p>
        )}
      </div>
    </Link>
  );
}
