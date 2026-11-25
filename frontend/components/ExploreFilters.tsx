"use client";

import { THEMES } from "@/lib/themes";
import { Icon } from "./Icon";
import { ViewToggle, type View } from "./ViewToggle";
import f from "./FilterBar.module.css";
import { TYPE_PLURALS } from "@/lib/content-types";

export type ExploreType = "all" | "essay" | "interview" | "feature";
export type ExploreTheme = "all" | (typeof THEMES)[number]["slug"];
export type ExploreSort = "newest" | "random";

export const TYPE_LABELS: Record<Exclude<ExploreType, "all">, string> = TYPE_PLURALS;

type Props = {
  type: ExploreType;
  theme: ExploreTheme;
  sort: ExploreSort;
  onTypeChange: (next: ExploreType) => void;
  onThemeChange: (next: ExploreTheme) => void;
  onSortChange: (next: ExploreSort) => void;
  view: View;
  onViewChange: (next: View) => void;
};

/** The select's chevron, shared with the phone sheet. */
export function Chevron() {
  return (
    <svg className={f.chevron} width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M16.59 8.59L12 13.17 7.41 8.59 6 10l6 6 6-6z" fill="currentColor" />
    </svg>
  );
}

/** Newest / Random, shared with the phone sheet. */
export function SortControl({
  sort,
  onSortChange,
}: {
  sort: ExploreSort;
  onSortChange: (next: ExploreSort) => void;
}) {
  return (
    <div className={f.segmented} role="group" aria-label="Sort">
      <button
        type="button"
        className={f.control}
        onClick={() => onSortChange("newest")}
        aria-pressed={sort === "newest"}
      >
        Newest
      </button>
      <button
        type="button"
        className={f.control}
        onClick={() => onSortChange("random")}
        aria-pressed={sort === "random"}
      >
        <Icon name="shuffle" size={16} />
        Random
      </button>
    </div>
  );
}

export function ExploreFilters({
  type,
  theme,
  sort,
  onTypeChange,
  onThemeChange,
  onSortChange,
  view,
  onViewChange,
}: Props) {
  return (
    <div className={`${f.bar} ${f.bleed}`}>
      <div className={f.group}>
        <p className={f.label} aria-hidden="true">Type</p>
        <div className={f.segmented} role="group" aria-label="Type">
          <button
            type="button"
            className={f.control}
            onClick={() => onTypeChange("all")}
            aria-pressed={type === "all"}
          >
            All
          </button>
          {(["essay", "interview", "feature"] as const).map((id) => (
            <button
              key={id}
              type="button"
              className={f.control}
              onClick={() => onTypeChange(id)}
              aria-pressed={type === id}
            >
              {TYPE_LABELS[id]}
            </button>
          ))}
        </div>
      </div>

      <div className={f.group}>
        <label className={f.label} htmlFor="explore-theme">Theme</label>
        <span className={f.selectWrap}>
          <select
            id="explore-theme"
            className={`${f.control} ${f.select}${theme !== "all" ? " " + f.selected : ""}`}
            value={theme}
            onChange={(e) => onThemeChange(e.target.value as ExploreTheme)}
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

      <div className={`${f.group} ${f.end}`}>
        <p className={f.label} aria-hidden="true">Sort</p>
        <SortControl sort={sort} onSortChange={onSortChange} />
      </div>

      <ViewToggle view={view} onChange={onViewChange} />
    </div>
  );
}
