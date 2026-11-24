"use client";

import styles from "./ExploreViewSwitch.module.css";

export type ExploreView = "grid" | "list";

const VIEWS: [ExploreView, string][] = [
  ["grid", "Grid"],
  ["list", "List"],
];

/**
 * Grid / List, as a small text toggle. Two aria-pressed buttons in a
 * named group, so a screen reader hears "View, Grid, toggle button,
 * pressed". The pressed one is set in full ink with an underline, so
 * the state never rests on colour alone.
 */
export function ExploreViewSwitch({
  view,
  onChange,
  size = "default",
}: {
  view: ExploreView;
  onChange: (next: ExploreView) => void;
  /** "touch" raises the targets to 44px for the phone bar. */
  size?: "default" | "touch";
}) {
  return (
    <div
      className={`${styles.switch}${size === "touch" ? " " + styles.touch : ""}`}
      role="group"
      aria-label="View"
    >
      {VIEWS.map(([id, label], i) => (
        <span key={id} className={styles.item}>
          {i > 0 && (
            <span className={styles.sep} aria-hidden="true">
              /
            </span>
          )}
          <button
            type="button"
            className={styles.option}
            aria-pressed={view === id}
            onClick={() => onChange(id)}
          >
            {label}
          </button>
        </span>
      ))}
    </div>
  );
}
