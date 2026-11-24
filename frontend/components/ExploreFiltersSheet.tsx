"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useDrag } from "@use-gesture/react";
import { useState } from "react";
import { THEMES } from "@/lib/themes";
import {
  Chevron,
  SortControl,
  TYPE_LABELS,
  type ExploreType,
  type ExploreTheme,
  type ExploreSort,
} from "./ExploreFilters";
import { Icon } from "./Icon";
import f from "./FilterBar.module.css";
import styles from "./ExploreFiltersSheet.module.css";

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
        <button type="button" className={f.control}>
          <Icon name="filter" size={16} />
          <span>Filters</span>
          {activeCount > 0 && (
            <span className={styles.count}>
              {activeCount}
              <span className={styles.srOnly}> active</span>
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
              <Icon name="close" />
            </Dialog.Close>
          </div>

          <div className={styles.body}>
            <div className={styles.group}>
              <label className={f.label} htmlFor="filter-type">
                Type
              </label>
              <span className={`${f.selectWrap} ${styles.full}`}>
                <select
                  id="filter-type"
                  className={`${f.control} ${f.select}${type !== "all" ? " " + f.selected : ""}`}
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
                <Chevron />
              </span>
            </div>

            <div className={styles.group}>
              <label className={f.label} htmlFor="filter-theme">
                Theme
              </label>
              <span className={`${f.selectWrap} ${styles.full}`}>
                <select
                  id="filter-theme"
                  className={`${f.control} ${f.select}${theme !== "all" ? " " + f.selected : ""}`}
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
                <Chevron />
              </span>
            </div>

            <div className={styles.group}>
              <p className={f.label} aria-hidden="true">Sort</p>
              <SortControl sort={sort} onSortChange={onSortChange} />
            </div>
          </div>

          <div className={styles.footer}>
            <button
              type="button"
              className={styles.applyButton}
              onClick={() => setOpen(false)}
            >
              Show {resultCount} {resultCount === 1 ? "story" : "stories"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
