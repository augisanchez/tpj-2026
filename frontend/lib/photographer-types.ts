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
  /** Their own sites and profiles, cleaned (lib/social-links.ts). */
  socials?: { label: string; href: string }[];
};

/**
 * Join photographer display names for an article byline. Uses "and"
 * with an Oxford comma for three or more contributors.
 *   ["A"]            → "A"
 *   ["A", "B"]       → "A and B"
 *   ["A", "B", "C"]  → "A, B, and C"
 * Group pieces (four or more) name the first two and count the rest,
 * so the hero byline stays one line. The article body and the
 * photographer cards still name everyone.
 *   ["A", "B", "C", "D"] → "A, B, and 2 others"
 * Empty list returns null so callers can drop the segment entirely.
 */
const GROUP_CREDIT_THRESHOLD = 4;

export function formatPhotographerNames(names: string[]): string | null {
  if (names.length === 0) return null;
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  if (names.length >= GROUP_CREDIT_THRESHOLD) {
    return `${names[0]}, ${names[1]}, and ${names.length - 2} others`;
  }
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}
