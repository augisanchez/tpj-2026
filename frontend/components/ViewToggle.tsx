"use client";

import { Icon } from "./Icon";
import f from "./FilterBar.module.css";

export type View = "grid" | "list";

const VIEWS: [View, string][] = [
  ["grid", "Grid"],
  ["list", "List"],
];

/**
 * Grid / List, as two joined icon buttons. Shared by Explore and
 * Photographers. Each button is aria-pressed in a named group, so a
 * screen reader hears "View, Grid view, toggle button, pressed"; the
 * pressed one is filled, so state never rests on colour alone. The
 * tooltip layer shows the data-tip on hover and keyboard focus.
 */
export function ViewToggle({
  view,
  onChange,
}: {
  view: View;
  onChange: (next: View) => void;
}) {
  return (
    <div className={f.segmented} role="group" aria-label="View">
      {VIEWS.map(([id, label]) => (
        <button
          key={id}
          type="button"
          className={`${f.control} ${f.iconOnly}`}
          aria-pressed={view === id}
          aria-label={`${label} view`}
          data-tip={label}
          onClick={() => onChange(id)}
        >
          <Icon name={id} />
        </button>
      ))}
    </div>
  );
}
