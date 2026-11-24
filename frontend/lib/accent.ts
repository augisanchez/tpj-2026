/** Number of colors in the accent rotation (see globals.css [data-accent]). */
export const ACCENT_COUNT = 5;

/**
 * Pick a color from the rotation for a stable key: an article slug, a
 * section name, or a date string like "2026-11-24" for a daily rotation.
 * Returns the value for a `data-accent` attribute.
 */
export function accentFor(key: string): string {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return String((h >>> 0) % ACCENT_COUNT);
}

/** Today's rotation key (UTC date), for page-level accents that change daily. */
export function todayKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}
