"use client";

import Link from "next/link";
import { PhotographerAvatar } from "./PhotographerAvatar";
import type { RoleCounts } from "@/lib/queries/photographers-index";
import styles from "./PhotographerListCard.module.css";
import { countOf, countStories } from "@/lib/content-types";

/** "3 photo essays · 1 interview · 2 interviews conducted · 1 feature written". */
function roleLine(c: RoleCounts): string {
  return [
    c.essays && countOf(c.essays, "essay"),
    c.features && countOf(c.features, "feature"),
    c.interviews && countOf(c.interviews, "interview"),
    c.conducted && `${countOf(c.conducted, "interview")} conducted`,
    c.written && `${countOf(c.written, "feature")} written`,
  ].filter(Boolean).join("  ·  ");
}

type Props = {
  name: string;
  slug: string;
  articleCount: number;
  /** Per-role counts; when present the count line names each role. */
  counts?: RoleCounts;
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
  counts,
  appearsInCount = 0,
  bio,
  portrait,
  centered = false,
  compact = false,
}: Props) {
  const className = `${styles.card}${centered ? " " + styles.centered : ""}`;
  return (
    <Link data-pz
      href={`/artist/${slug}`}
      className={className}
    >
      {/* The circle stays put; the photo inside drifts with the pointer
          (pz-media) and the circle takes the green hover ring, the same
          pattern as every article card. */}
      <div className={styles.portraitWrapper}>
        <PhotographerAvatar
          name={name}
          portrait={portrait ?? undefined}
          className={`${styles.portrait} pz-media`}
        />
      </div>
      <h3 className={styles.cardName}>{name}</h3>
      {!compact && bio && <p className={styles.cardBio}>{bio}</p>}
      {(counts ? roleLine(counts) : articleCount > 0) && (
        <p className={styles.cardCount}>
          {counts ? roleLine(counts) : countStories(articleCount)}
          {appearsInCount > 0 && `  ·  appears in ${appearsInCount}`}
          <span className={styles.cardCountArrow} aria-hidden="true">
            →
          </span>
        </p>
      )}
    </Link>
  );
}
