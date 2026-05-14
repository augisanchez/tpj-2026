"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ThemeThumbnail } from "./ThemeThumbnail";
import {
  cardSpring,
  imageScaleVariants,
  titleAccentTransition,
  titleAccentVariants,
} from "@/lib/card-motion";
import styles from "./ThemesIndex.module.css";

const MotionLink = motion.create(Link);

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
 * server-rendered while the card opts into motion (spring scale on
 * the composite thumbnail + lime title accent that draws in).
 */
export function ThemeIndexCard({ slug, name, prompt, count, images }: Props) {
  return (
    <MotionLink
      href={`/theme/${slug}`}
      className={styles.card}
      initial="rest"
      animate="rest"
      whileHover="hover"
    >
      <motion.div
        className={styles.cardThumb}
        variants={imageScaleVariants}
        transition={cardSpring}
      >
        <ThemeThumbnail images={images} />
      </motion.div>
      <div className={styles.cardText}>
        {count != null && (
          <p className={styles.cardCount}>
            {count} {count === 1 ? "article" : "articles"}
          </p>
        )}
        <h2 className={styles.cardName}>
          {name}
          <motion.span
            className={styles.cardNameAccent}
            aria-hidden="true"
            variants={titleAccentVariants}
            transition={titleAccentTransition}
            style={{ originX: 0 }}
          />
        </h2>
        <p className={styles.cardPrompt}>{prompt}</p>
      </div>
    </MotionLink>
  );
}
