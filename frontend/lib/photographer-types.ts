/**
 * Shared Photographer shape used across queries and view components.
 * Kept in `lib/` (not under `components/`) so query files can depend on
 * it without reaching into the component layer.
 */
export type Photographer = {
  name: string;
  slug: string;
  bio?: string;
  articleCount: number;
  portrait?: { src: string; alt: string };
};

/**
 * Join photographer display names for an article byline. Uses "and"
 * with an Oxford comma for three or more contributors.
 *   ["A"]            → "A"
 *   ["A", "B"]       → "A and B"
 *   ["A", "B", "C"]  → "A, B, and C"
 * Empty list returns null so callers can drop the segment entirely.
 */
export function formatPhotographerNames(names: string[]): string | null {
  if (names.length === 0) return null;
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}
