import type { Photographer } from "@/lib/photographer-types";

/**
 * Placeholder photographer used by the homepage Spotlight section and
 * the "About the photographer" block on essay/interview/feature pages
 * until the real photographer migration runs and ACF relationships
 * connect each article to its photographer.
 *
 * After `wp tpj migrate-photographers` and the per-article photographer
 * relationship is set, replace these usages with a query against the
 * actual photographer record on each article.
 */
export const FALLBACK_PHOTOGRAPHER: Photographer = {
  name: "Kate Sweeney",
  slug: "kate-sweeney",
  bio: "Kate Sweeney is a photographer whose work bridges commercial, editorial, and fine art photography. Her ongoing series Residence explores notions of home and belonging.",
  articleCount: 30,
  portrait: {
    src: "/photographers/kate-sweeney.jpg",
    alt: "Kate Sweeney",
  },
};
