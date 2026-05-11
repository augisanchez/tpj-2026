import { gql } from "graphql-request";
import { wpClient } from "../api";
import { rewriteMediaUrl } from "../media";
import { htmlToInlineText, titleCaseName } from "../text-utils";

const RecentEssaysQuery = gql`
  query RecentEssays($first: Int = 6) {
    essays(
      first: $first
      where: { status: PUBLISH, orderby: { field: DATE, order: DESC } }
    ) {
      nodes {
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
  }
`;

export type FeaturedImage = {
  src: string;
  alt: string;
  width?: number;
  height?: number;
};

export type RecentEssay = {
  id: string;
  title: string;
  slug: string;
  date: string;
  excerpt: string | null;
  photographerName: string | null;
  featuredImage: FeaturedImage | null;
};

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
      mediaDetails?: { width: number | null; height: number | null } | null;
    } | null;
  } | null;
};

type Response = {
  essays: { nodes: RawEssay[] };
};

/**
 * WordPress excerpts arrive as `<p>`-wrapped HTML with entity escapes
 * (`&#8217;`, `&hellip;`, `&amp;`) and a trailing `[…] Continue reading`
 * marker WP appends to truncated text. Strip the tags via the shared
 * `htmlToInlineText`, then drop the WP-specific markers.
 */
function cleanExcerpt(html: string | null): string | null {
  if (!html) return null;
  const cleaned = htmlToInlineText(html)
    .replace(/\[…\]/g, "")
    .replace(/Continue reading.*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || null;
}

/**
 * Pick a single display credit for an article: the first linked
 * photographer's title (canonicalized) when present, falling back to the
 * legacy raw photographerName string. Mirrors the priority used on the
 * detail pages so list and detail views stay consistent.
 */
export function resolvePhotographerCredit(input: {
  photographerName: string | null;
  linkedPhotographer: { title: string | null } | null;
  linkedPhotographers: { title: string | null }[] | null;
}): string | null {
  const firstLinked = input.linkedPhotographers?.[0]?.title;
  if (firstLinked) return titleCaseName(firstLinked);
  if (input.linkedPhotographer?.title)
    return titleCaseName(input.linkedPhotographer.title);
  const legacy = input.photographerName?.trim();
  return legacy ? legacy : null;
}

export async function fetchRecentEssays(first = 6): Promise<RecentEssay[]> {
  const data = await wpClient.request<Response>(RecentEssaysQuery, { first });
  return data.essays.nodes.map((node): RecentEssay => {
    const fi = node.featuredImage?.node;
    const src = fi ? rewriteMediaUrl(fi.sourceUrl) : null;
    return {
      id: node.id,
      title: node.title,
      slug: node.slug,
      date: node.date,
      excerpt: cleanExcerpt(node.excerpt),
      photographerName: resolvePhotographerCredit(node),
      featuredImage: src
        ? {
            src,
            alt: fi?.altText || node.title,
            width: fi?.mediaDetails?.width ?? undefined,
            height: fi?.mediaDetails?.height ?? undefined,
          }
        : null,
    };
  });
}
