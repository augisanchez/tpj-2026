"use client";

import { THEMES } from "@/lib/themes";
import styles from "./ExploreFilters.module.css";

export type ExploreType = "all" | "essay" | "interview" | "feature";
export type ExploreTheme = "all" | (typeof THEMES)[number]["slug"];
export type ExploreSort = "newest" | "random";

const TYPE_LABELS: Record<Exclude<ExploreType, "all">, string> = {
  essay: "Photo Essays",
  interview: "Interviews",
  feature: "Features",
};

type Props = {
  type: ExploreType;
  theme: ExploreTheme;
  sort: ExploreSort;
  onTypeChange: (next: ExploreType) => void;
  onThemeChange: (next: ExploreTheme) => void;
  onSortChange: (next: ExploreSort) => void;
};

export function ExploreFilters({
  type,
  theme,
  sort,
  onTypeChange,
  onThemeChange,
  onSortChange,
}: Props) {
  return (
    <div className={styles.bar}>
      <div className={styles.group}>
        <p className={styles.label}>Type</p>
        <div className={styles.chips}>
          <button
            type="button"
            className={`${styles.chip}${type === "all" ? " " + styles.chipActive : ""}`}
            onClick={() => onTypeChange("all")}
            aria-pressed={type === "all"}
          >
            All
          </button>
          {(["essay", "interview", "feature"] as const).map((id) => (
            <button
              key={id}
              type="button"
              className={`${styles.chip}${type === id ? " " + styles.chipActive : ""}`}
              onClick={() => onTypeChange(id)}
              aria-pressed={type === id}
            >
              {TYPE_LABELS[id]}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.group}>
        <p className={styles.label}>Theme</p>
        <span className={styles.themeWrap}>
          <select
            className={`${styles.themeSelect}${theme !== "all" ? " " + styles.themeSelectActive : ""}`}
            value={theme}
            onChange={(e) => onThemeChange(e.target.value as ExploreTheme)}
            aria-label="Filter by theme"
          >
            <option value="all">All themes</option>
            {THEMES.map((t) => (
              <option key={t.slug} value={t.slug}>
                {t.name}
              </option>
            ))}
          </select>
          <svg
            className={styles.themeChevron}
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
      </div>

      <div className={`${styles.group} ${styles.sortGroup}`}>
        <p className={styles.label}>Sort</p>
        <div className={styles.chips}>
          <button
            type="button"
            className={`${styles.chip}${sort === "newest" ? " " + styles.chipActive : ""}`}
            onClick={() => onSortChange("newest")}
            aria-pressed={sort === "newest"}
          >
            Newest
          </button>
          <button
            type="button"
            className={`${styles.chip}${sort === "random" ? " " + styles.chipActive : ""}`}
            onClick={() => onSortChange("random")}
            aria-pressed={sort === "random"}
          >
            Random
          </button>
        </div>
      </div>
    </div>
  );
}
