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
