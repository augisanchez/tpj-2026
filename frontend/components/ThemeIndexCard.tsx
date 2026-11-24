"use client";

import Link from "next/link";
import { ThemeThumbnail } from "./ThemeThumbnail";
import styles from "./ThemesIndex.module.css";

type Props = {
  slug: string;
  name: string;
  prompt: string;
  count: number | null;
  images: { src: string; alt: string }[];
};

/**
 * Single theme card on the /themes index. Extracted into its own
 * client component so the surrounding async server page can stay
 * server-rendered while the card opts into the pointer zoom (on
 * the composite thumbnail).
 */
export function ThemeIndexCard({ slug, name, prompt, count, images }: Props) {
  return (
    <Link data-pz
      href={`/theme/${slug}`}
      className={styles.card}
    >
      <div
        className={`${styles.cardThumb} pz-media`}
      >
        <ThemeThumbnail images={images} />
      </div>
      <div className={styles.cardText}>
        {count != null && (
          <p className={styles.cardCount}>
            {count} {count === 1 ? "story" : "stories"}
          </p>
        )}
        <h2 className={styles.cardName}>{name}</h2>
        <p className={styles.cardPrompt}>{prompt}</p>
      </div>
    </Link>
  );
}
