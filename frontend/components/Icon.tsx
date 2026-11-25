import type { ReactNode } from "react";
import styles from "./Icon.module.css";

export type IconName =
  | "shuffle"
  | "search"
  | "grid"
  | "list"
  | "filter"
  | "close"
  | "arrowUp"
  | "instagram"
  | "x"
  | "facebook"
  | "globe"
  | "flickr"
  | "link";

/**
 * The one icon set. Every glyph is drawn on the header's grid: a 24
 * unit viewBox, 2 unit stroke, round caps and joins, no fill, and the
 * drawing kept inside 3 to 21 so every glyph sits at the same optical
 * size. The brand marks (instagram, x, facebook) follow the same rules:
 * outlines, not the platforms' filled logos.
 */
const GLYPHS: Record<IconName, ReactNode> = {
  shuffle: (
    <>
      <polyline points="16 3 21 3 21 8" />
      <line x1="4" y1="20" x2="21" y2="3" />
      <polyline points="21 16 21 21 16 21" />
      <line x1="15" y1="15" x2="21" y2="21" />
      <line x1="4" y1="4" x2="9" y2="9" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </>
  ),
  grid: (
    <>
      <rect x="4" y="4" width="6" height="6" rx="1" />
      <rect x="14" y="4" width="6" height="6" rx="1" />
      <rect x="4" y="14" width="6" height="6" rx="1" />
      <rect x="14" y="14" width="6" height="6" rx="1" />
    </>
  ),
  list: (
    <>
      <line x1="9" y1="6" x2="20" y2="6" />
      <line x1="9" y1="12" x2="20" y2="12" />
      <line x1="9" y1="18" x2="20" y2="18" />
      <line x1="4" y1="6" x2="4.01" y2="6" />
      <line x1="4" y1="12" x2="4.01" y2="12" />
      <line x1="4" y1="18" x2="4.01" y2="18" />
    </>
  ),
  filter: (
    <>
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="7" y1="12" x2="17" y2="12" />
      <line x1="10" y1="18" x2="14" y2="18" />
    </>
  ),
  close: (
    <>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </>
  ),
  arrowUp: (
    <>
      <line x1="12" y1="20" x2="12" y2="4" />
      <polyline points="5 11 12 4 19 11" />
    </>
  ),
  instagram: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="4" />
      <circle cx="12" cy="12" r="3.5" />
      <line x1="16.5" y1="7.5" x2="16.51" y2="7.5" />
    </>
  ),
  x: (
    <>
      <path d="M4 4l11.733 16h4.267l-11.733 -16z" />
      <path d="M4 20l6.768 -6.768m2.46 -2.46l6.772 -6.772" />
    </>
  ),
  facebook: (
    <path d="M7 10v4h3v7h4v-7h3l1 -4h-4v-2a1 1 0 0 1 1 -1h3v-4h-3a5 5 0 0 0 -5 5v2h-3" />
  ),
  // A personal site or blog.
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <path d="M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0 -18" />
    </>
  ),
  flickr: (
    <>
      <circle cx="7.5" cy="12" r="3.5" />
      <circle cx="16.5" cy="12" r="3.5" />
    </>
  ),
  // Any other profile (Tumblr, Vimeo, VSCO, Bluesky, Threads, LinkedIn).
  link: (
    <>
      <path d="M10 14a3.5 3.5 0 0 0 5 0l4 -4a3.5 3.5 0 0 0 -5 -5l-.5 .5" />
      <path d="M14 10a3.5 3.5 0 0 0 -5 0l-4 4a3.5 3.5 0 0 0 5 5l.5 -.5" />
    </>
  ),
};

/**
 * Decorative: always aria-hidden, the control around it carries the
 * label. `size` is the box in px (20 matches the header). `inline`
 * instead sizes the glyph to the cap height of the surrounding text and
 * sits it on the baseline, for an icon set in a line of type; the
 * text's cap height comes from `--cap` (Inter by default).
 */
export function Icon({
  name,
  size = 20,
  inline = false,
  className,
}: {
  name: IconName;
  size?: number;
  inline?: boolean;
  className?: string;
}) {
  const cls = [inline ? styles.inline : "", className ?? ""].filter(Boolean).join(" ");
  return (
    <svg
      width={inline ? undefined : size}
      height={inline ? undefined : size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={cls || undefined}
    >
      {GLYPHS[name]}
    </svg>
  );
}
