import { gql } from "graphql-request";
import { wpClient } from "../api";
import { rewriteMediaUrl } from "../media";

export type ExploreItem = {
  id: string;
  title: string;
  slug: string;
  date: string;
  contentType: "essay" | "interview" | "feature";
  featuredImage: { src: string; alt: string } | null;
  themes: string[];
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
            sourceUrl(size: LARGE)
            altText
          }
        }
        themes {
          nodes {
            slug
          }
        }
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
    node: { sourceUrl: string | null; altText: string | null } | null;
  } | null;
  themes: { nodes: { slug: string | null }[] | null } | null;
};

type PageResponse = Record<
  string,
  { pageInfo: { hasNextPage: boolean; endCursor: string | null }; nodes: RawNode[] }
>;

function toItem(
  node: RawNode,
  contentType: ExploreItem["contentType"]
): ExploreItem {
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
      ? { src, alt: fi?.altText || node.title }
      : null,
    themes,
  };
}

async function fetchType(
  contentType: ExploreItem["contentType"],
  limit: number
): Promise<ExploreItem[]> {
  const field = LIST_FIELD[contentType];
  const query = pagedQuery(field);
  const out: ExploreItem[] = [];
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

export async function fetchExplore(perType = 1000): Promise<ExploreItem[]> {
  // Sequential on purpose: one modest request at a time for the CMS.
  const essays = await fetchType("essay", perType);
  const interviews = await fetchType("interview", perType);
  const features = await fetchType("feature", perType);
  const items = [...essays, ...interviews, ...features];
  items.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  return items;
}
