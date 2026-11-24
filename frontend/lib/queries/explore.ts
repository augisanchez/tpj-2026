import { gql } from "graphql-request";
import { wpClient } from "../api";
import { rewriteMediaUrl } from "../media";
import { resolvePhotographerCredit } from "./recent-essays";

export type ExploreItem = {
  id: string;
  title: string;
  slug: string;
  date: string;
  contentType: "essay" | "interview" | "feature";
  featuredImage: { src: string; alt: string; width?: number; height?: number } | null;
  themes: string[];
};

/** An Explore item with its credit and catalogue number, as the grid
 *  and the numbered list need it. */
export type ExploreStory = ExploreItem & {
  /** Display credit, same precedence as the story pages. */
  photographer: string | null;
  /** Profile slug when the credit is a linked Photographer record. */
  photographerSlug: string | null;
  /** Permanent catalogue number across every story: the oldest is No. 1. */
  no: number;
};

// One content type per request, paged. Asking for the whole archive in
// one query ran the 1GB CMS out of PHP memory during builds.
const PAGE = 200;
const LIST_FIELD = { essay: "essays", interview: "interviews", feature: "features" } as const;

function pagedQuery(field: string) {
  return gql`
    query ExplorePage($first: Int!, $after: String) {
      ${field}(
        first: $first
        after: $after
        where: { status: PUBLISH, orderby: { field: DATE, order: DESC } }
      ) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
        __typename
        id
        title
        slug
        date
        featuredImage {
          node {
            sourceUrl
            altText
            mediaDetails { width height }
          }
        }
        themes {
          nodes {
            slug
          }
        }
        photographerName
        linkedPhotographer { title slug }
        linkedPhotographers { title slug }
        }
      }
    }
  `;
}

type RawNode = {
  __typename: string;
  id: string;
  title: string;
  slug: string;
  date: string;
  featuredImage: {
    node: { sourceUrl: string | null; altText: string | null; mediaDetails?: { width: number | null; height: number | null } | null; } | null;
  } | null;
  themes: { nodes: { slug: string | null }[] | null } | null;
  photographerName: string | null;
  linkedPhotographer: { title: string | null; slug: string | null } | null;
  linkedPhotographers: { title: string | null; slug: string | null }[] | null;
};

type PageResponse = Record<
  string,
  { pageInfo: { hasNextPage: boolean; endCursor: string | null }; nodes: RawNode[] }
>;

/** Slug of the record the credit names (same precedence as
 *  resolvePhotographerCredit), or null for a plain-text credit. */
function creditSlug(n: RawNode): string | null {
  if (n.linkedPhotographers?.[0]?.title) return n.linkedPhotographers[0].slug ?? null;
  if (n.linkedPhotographer?.title) return n.linkedPhotographer.slug ?? null;
  return null;
}

function toItem(
  node: RawNode,
  contentType: ExploreItem["contentType"]
): Omit<ExploreStory, "no"> {
  const fi = node.featuredImage?.node;
  const src = fi ? rewriteMediaUrl(fi.sourceUrl) : null;
  const themes =
    node.themes?.nodes
      ?.map((n) => n.slug)
      .filter((s): s is string => typeof s === "string" && s.length > 0) ?? [];
  return {
    id: node.id,
    title: node.title,
    slug: node.slug,
    date: node.date,
    contentType,
    featuredImage: src
      ? { src, alt: fi?.altText || node.title, width: fi?.mediaDetails?.width ?? undefined, height: fi?.mediaDetails?.height ?? undefined }
      : null,
    themes,
    photographer: resolvePhotographerCredit(node),
    photographerSlug: creditSlug(node),
  };
}

async function fetchType(
  contentType: ExploreItem["contentType"],
  limit: number
): Promise<Omit<ExploreStory, "no">[]> {
  const field = LIST_FIELD[contentType];
  const query = pagedQuery(field);
  const out: Omit<ExploreStory, "no">[] = [];
  let after: string | null = null;
  while (out.length < limit) {
    const data: PageResponse = await wpClient.request<PageResponse>(query, {
      first: Math.min(PAGE, limit - out.length),
      after,
    });
    const page = data[field];
    out.push(...page.nodes.map((n) => toItem(n, contentType)));
    if (!page.pageInfo.hasNextPage || !page.pageInfo.endCursor) break;
    after = page.pageInfo.endCursor;
  }
  return out;
}

export async function fetchExplore(perType = 1000): Promise<ExploreStory[]> {
  // Sequential on purpose: one modest request at a time for the CMS.
  const essays = await fetchType("essay", perType);
  const interviews = await fetchType("interview", perType);
  const features = await fetchType("feature", perType);
  const time = (d: string) => new Date(d).getTime();
  // Number oldest first, in the same order as lib/queries/story-index.ts
  // (which the 404 page reads), so a story keeps one number site-wide.
  const oldestFirst = [...essays, ...interviews, ...features].sort(
    (a, b) => time(a.date) - time(b.date)
  );
  const items: ExploreStory[] = oldestFirst.map((s, i) => ({ ...s, no: i + 1 }));
  items.sort((a, b) => time(b.date) - time(a.date));
  return items;
}
