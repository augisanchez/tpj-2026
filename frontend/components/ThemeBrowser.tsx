"use client";

import Link from "next/link";
import { useState } from "react";
import { AnimatePresence, motion, type Variants } from "motion/react";
import { ArticleCard } from "./ArticleCard";
import { THEMES } from "@/lib/themes";
import type { RecentEssay } from "@/lib/queries/recent-essays";
import styles from "./ThemeBrowser.module.css";

type Props = {
  groups: Record<string, RecentEssay[]>;
};

// Variants for the chip-swap animation. AnimatePresence (mode="wait")
// drives the sequence:
//   1. Active group's cards run their exit variant (stagger from last
//      to first, ~50ms apart).
//   2. New group mounts; its cards run the visible variant (stagger
//      from first to last, ~100ms apart, larger lift).
// On first mount the cards also use the visible variant — same
// cascade effect that StaggerReveal previously provided, but driven
// here so chip-swap exit can share the same vocabulary.
// Tuned so a full chip-swap (exit-then-enter via mode="wait") lands
// just under a second. Exit is intentionally tighter than enter —
// the outgoing cards are leaving, not the focus; the new set is.
const containerVariants: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.07,
      delayChildren: 0.02,
    },
  },
  exit: {
    transition: {
      staggerChildren: 0.04,
      staggerDirection: -1,
    },
  },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 28 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.2, 0.6, 0.2, 1] },
  },
  exit: {
    opacity: 0,
    y: 12,
    transition: { duration: 0.2, ease: [0.4, 0, 1, 1] },
  },
};

export function ThemeBrowser({ groups }: Props) {
  const [activeSlug, setActiveSlug] = useState(THEMES[0].slug);
  const cards = groups[activeSlug] ?? [];

  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <div className={styles.headerTop}>
          <h2 className={styles.title}>Themes</h2>
          <Link href="/themes" className={styles.exploreLink}>
            Explore themes
            <span className={styles.exploreArrow} aria-hidden="true">
              →
            </span>
          </Link>
        </div>
        <p className={styles.description}>
          Each theme gathers articles around a shared idea for you to explore.
        </p>
      </div>

      <div
        className={`${styles.chipRow} ${styles.desktopOnly}`}
        role="tablist"
        aria-label="Themes"
      >
        {THEMES.map((theme) => {
          const isActive = theme.slug === activeSlug;
          return (
            <button
              key={theme.slug}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`${styles.chip}${isActive ? " " + styles.chipActive : ""}`}
              onClick={() => setActiveSlug(theme.slug)}
            >
              {theme.name}
            </button>
          );
        })}
      </div>

      <span className={`${styles.selectWrap} ${styles.mobileOnly}`}>
        <select
          className={styles.select}
          value={activeSlug}
          onChange={(e) => setActiveSlug(e.target.value)}
          aria-label="Choose a theme"
        >
          {THEMES.map((theme) => (
            <option key={theme.slug} value={theme.slug}>
              {theme.name}
            </option>
          ))}
        </select>
        <svg
          className={styles.selectChevron}
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M16.59 8.59L12 13.17 7.41 8.59 6 10l6 6 6-6z"
            fill="currentColor"
          />
        </svg>
      </span>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeSlug}
          className={styles.cards}
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          exit="exit"
          viewport={{ once: true, amount: 0.1 }}
        >
          {cards.map((essay) => (
            <motion.div key={essay.id} variants={cardVariants}>
              <ArticleCard
                variant="5up"
                article={{
                  title: essay.title,
                  date: essay.date,
                  href: `/essay/${essay.slug}`,
                  contentTypeLabel: "Photo Essay",
                  featuredImage: essay.featuredImage ?? undefined,
                }}
              />
            </motion.div>
          ))}
        </motion.div>
      </AnimatePresence>
    </section>
  );
}
