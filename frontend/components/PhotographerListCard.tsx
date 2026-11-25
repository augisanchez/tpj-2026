"use client";

import Link from "next/link";
import { PhotographerAvatar } from "./PhotographerAvatar";
import type { RoleCounts } from "@/lib/queries/photographers-index";
import styles from "./PhotographerListCard.module.css";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "3 photo stories · 2 interviews conducted · 1 feature written". */
function roleLine(c: RoleCounts): string {
  return [
    c.photographs && plural(c.photographs, "photo story", "photo stories"),
    c.interviews && plural(c.interviews, "interview", "interviews"),
    c.conducted && plural(c.conducted, "interview conducted", "interviews conducted"),
    c.written && plural(c.written, "feature written", "features written"),
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
      {(counts ? roleLine(counts) : articleCount > 0) && (
        <p className={styles.cardCount}>
          {counts ? roleLine(counts) : `${articleCount} ${articleCount === 1 ? "story" : "stories"}`}
          {appearsInCount > 0 && `  ·  appears in ${appearsInCount}`}
          <span className={styles.cardCountArrow} aria-hidden="true">
            →
          </span>
        </p>
      )}
    </Link>
  );
}
