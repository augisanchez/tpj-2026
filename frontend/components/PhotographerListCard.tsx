"use client";

import Link from "next/link";
import { PhotographerAvatar } from "./PhotographerAvatar";
import styles from "./PhotographerListCard.module.css";

type Props = {
  name: string;
  slug: string;
  articleCount: number;
  /** Pieces they appear in that someone else shot (model, subject). */
  appearsInCount?: number;
  bio?: string | null;
  portrait?: { src: string; alt: string } | null;
  /**
   * When true, name / bio / article count center horizontally under the
   * portrait. Used by the article-end credit; the photographers index
   * keeps the default left-aligned treatment.
   */
  centered?: boolean;
  /**
   * When true, suppress the bio preview. Used at article-end so the
   * card is a clean link to the full profile, where the bio lives.
   */
  compact?: boolean;
};

/**
 * The directory-style photographer card: circle portrait, name, optional
 * bio preview (line-clamped to 2 lines), and an article-count link. Used
 * on the photographers index and at the bottom of every article in
 * AboutPhotographerSection so the visual treatment matches across
 * surfaces.
 */
export function PhotographerListCard({
  name,
  slug,
  articleCount,
  appearsInCount = 0,
  bio,
  portrait,
  centered = false,
  compact = false,
}: Props) {
  const className = `${styles.card}${centered ? " " + styles.centered : ""}`;
  return (
    <Link data-pz
      href={`/photographer/${slug}`}
      className={className}
    >
      <div
        className={`${styles.portraitWrapper} pz-media`}
      >
        <PhotographerAvatar
          name={name}
          portrait={portrait ?? undefined}
          className={styles.portrait}
        />
      </div>
      <h3 className={styles.cardName}>{name}</h3>
      {!compact && bio && <p className={styles.cardBio}>{bio}</p>}
      {articleCount > 0 && (
        <p className={styles.cardCount}>
          {articleCount} {articleCount === 1 ? "article" : "articles"}
          {appearsInCount > 0 && `  ·  appears in ${appearsInCount}`}
          <span className={styles.cardCountArrow} aria-hidden="true">
            →
          </span>
        </p>
      )}
    </Link>
  );
}
