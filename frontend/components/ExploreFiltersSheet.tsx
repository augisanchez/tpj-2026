"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useDrag } from "@use-gesture/react";
import { useState } from "react";
import { THEMES } from "@/lib/themes";
import type {
  ExploreType,
  ExploreTheme,
  ExploreSort,
} from "./ExploreFilters";
import styles from "./ExploreFiltersSheet.module.css";

const TYPE_LABELS: Record<Exclude<ExploreType, "all">, string> = {
  essay: "Photo Essays",
  interview: "Interviews",
  feature: "Features",
};

const SWIPE_CLOSE_DISTANCE = 80;
const SWIPE_CLOSE_VELOCITY = 0.5;

type Props = {
  type: ExploreType;
  theme: ExploreTheme;
  sort: ExploreSort;
  onTypeChange: (next: ExploreType) => void;
  onThemeChange: (next: ExploreTheme) => void;
  onSortChange: (next: ExploreSort) => void;
  resultCount: number;
};

export function ExploreFiltersSheet({
  type,
  theme,
  sort,
  onTypeChange,
  onThemeChange,
  onSortChange,
  resultCount,
}: Props) {
  const [open, setOpen] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);

  const activeCount =
    (type !== "all" ? 1 : 0) +
    (theme !== "all" ? 1 : 0) +
    (sort !== "newest" ? 1 : 0);

  const bind = useDrag(
    ({ down, movement: [, my], velocity: [, vy] }) => {
      if (down) {
        setDragging(true);
        setDragY(Math.max(0, my));
      } else {
        setDragging(false);
        setDragY(0);
        if (my > SWIPE_CLOSE_DISTANCE || vy > SWIPE_CLOSE_VELOCITY) {
          setOpen(false);
        }
      }
    },
    { axis: "y", filterTaps: true, pointer: { touch: true } }
  );

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button type="button" className={styles.trigger}>
          <span>Filters</span>
          {activeCount > 0 && (
            <span className={styles.count} aria-label={`${activeCount} active`}>
              {activeCount}
            </span>
          )}
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content
          className={styles.content}
          style={
            dragging
              ? { transform: `translateY(${dragY}px)`, transition: "none" }
              : undefined
          }
          aria-describedby={undefined}
        >
          <div className={styles.handleArea} {...bind()}>
            <div className={styles.handle} />
          </div>
          <div className={styles.header}>
            <Dialog.Title className={styles.title}>Filters</Dialog.Title>
            <Dialog.Close className={styles.close} aria-label="Close filters">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </Dialog.Close>
          </div>

          <div className={styles.body}>
            <div className={styles.group}>
              <label className={styles.label} htmlFor="filter-type">
                Type
              </label>
              <span className={styles.selectWrap}>
                <select
                  id="filter-type"
                  className={styles.select}
                  value={type}
                  onChange={(e) => onTypeChange(e.target.value as ExploreType)}
                >
                  <option value="all">All types</option>
                  {(["essay", "interview", "feature"] as const).map((id) => (
                    <option key={id} value={id}>
                      {TYPE_LABELS[id]}
                    </option>
                  ))}
                </select>
                <svg
                  className={styles.chevron}
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

            <div className={styles.group}>
              <label className={styles.label} htmlFor="filter-theme">
                Theme
              </label>
              <span className={styles.selectWrap}>
                <select
                  id="filter-theme"
                  className={styles.select}
                  value={theme}
                  onChange={(e) =>
                    onThemeChange(e.target.value as ExploreTheme)
                  }
                >
                  <option value="all">All themes</option>
                  {THEMES.map((t) => (
                    <option key={t.slug} value={t.slug}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <svg
                  className={styles.chevron}
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

            <div className={styles.group}>
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

          <div className={styles.footer}>
            <button
              type="button"
              className={styles.applyButton}
              onClick={() => setOpen(false)}
            >
              Show {resultCount} {resultCount === 1 ? "result" : "results"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
