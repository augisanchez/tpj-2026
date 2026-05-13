import { gql } from "graphql-request";
import { wpClient } from "../api";
import { rewriteMediaUrl } from "../media";
import { htmlToInlineText, titleCaseName } from "../text-utils";
import type { FeaturedImage, RecentEssay } from "./recent-essays";

// Filters essays by tpj-theme taxonomy term. Powered by AI tagging
// (Build Plan Step 12) — see `wp tpj tag-themes`. Before that has
// run, themes may have 0 tagged essays; callers should fall back
// to a random sample for empty groups so the UI doesn't read as
// broken.
//
// Backed by the custom `essaysByThemeSlug` root field in
// inc/graphql.php — WPGraphQL 2.x doesn't expose the auto-generated
// taxonomy where-arg on the essays connection, so we resolve
// server-side via WP_Query tax_query.
const EssaysByThemeQuery = gql`
  query EssaysByTheme($first: Int = 12, $slug: String!) {
    essaysByThemeSlug(themeSlug: $slug, first: $first) {
      id
      title
      slug
      date
      excerpt
      photographerName
      linkedPhotographer {
        title
      }
      linkedPhotographers {
        title
      }
      featuredImage {
        node {
          sourceUrl
          altText
          mediaDetails {
            width
            height
          }
        }
      }
    }
  }
`;

type RawEssay = {
  id: string;
  title: string;
  slug: string;
  date: string;
  excerpt: string | null;
  photographerName: string | null;
  linkedPhotographer: { title: string | null } | null;
  linkedPhotographers: { title: string | null }[] | null;
  featuredImage: {
    node: {
      sourceUrl: string | null;
      altText: string | null;
      mediaDetails: { width: number | null; height: number | null } | null;
    } | null;
  } | null;
};

type Response = { essaysByThemeSlug: RawEssay[] | null };

function toRecentEssay(node: RawEssay): RecentEssay {
  const fi = node.featuredImage?.node;
  const src = fi ? rewriteMediaUrl(fi.sourceUrl) : null;
  const photographerName =
    node.linkedPhotographers?.[0]?.title ??
    node.linkedPhotographer?.title ??
    node.photographerName ??
    null;

  let featuredImage: FeaturedImage | null = null;
  if (src) {
    featuredImage = {
      src,
      alt: fi?.altText || node.title,
    };
    if (fi?.mediaDetails?.width) featuredImage.width = fi.mediaDetails.width;
    if (fi?.mediaDetails?.height) featuredImage.height = fi.mediaDetails.height;
  }

  return {
    id: node.id,
    title: node.title,
    slug: node.slug,
    date: node.date,
    excerpt: node.excerpt ? htmlToInlineText(node.excerpt) : null,
    photographerName: photographerName
      ? titleCaseName(photographerName)
      : null,
    featuredImage,
  };
}

/**
 * Fetch essays tagged with a single theme slug. Returns empty array
 * when no tagged essays exist for the theme — caller decides whether
 * to fall back to a random sample, show an empty state, etc.
 */
export async function fetchEssaysByTheme(
  slug: string,
  first = 12
): Promise<RecentEssay[]> {
  const data = await wpClient.request<Response>(EssaysByThemeQuery, {
    first,
    slug,
  });
  return (data.essaysByThemeSlug ?? []).map(toRecentEssay);
}

/**
 * Parallel-fetch essays for multiple theme slugs. Returns a
 * record keyed by slug. Each slug's value is the essays tagged
 * with that theme (may be empty). Used by the homepage
 * ThemeBrowser to render all theme groups in one request batch.
 */
export async function fetchEssaysByThemes(
  slugs: string[],
  perTheme = 6
): Promise<Record<string, RecentEssay[]>> {
  const results = await Promise.all(
    slugs.map((slug) => fetchEssaysByTheme(slug, perTheme))
  );
  const out: Record<string, RecentEssay[]> = {};
  slugs.forEach((slug, i) => {
    out[slug] = results[i];
  });
  return out;
}
