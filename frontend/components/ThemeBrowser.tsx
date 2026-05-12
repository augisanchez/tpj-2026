"use client";

import Link from "next/link";
import { useState } from "react";
import { ArticleCard } from "./ArticleCard";
import { StaggerReveal } from "./StaggerReveal";
import { THEMES } from "@/lib/themes";
import type { RecentEssay } from "@/lib/queries/recent-essays";
import styles from "./ThemeBrowser.module.css";

type Props = {
  groups: Record<string, RecentEssay[]>;
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

      <StaggerReveal className={styles.cards} key={activeSlug}>
        {cards.map((essay) => (
          <ArticleCard
            key={essay.id}
            variant="5up"
            article={{
              title: essay.title,
              date: essay.date,
              href: `/essay/${essay.slug}`,
              contentTypeLabel: "Photo Essay",
              featuredImage: essay.featuredImage ?? undefined,
            }}
          />
        ))}
      </StaggerReveal>
    </section>
  );
}
