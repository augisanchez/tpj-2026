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

const ExploreQuery = gql`
  query Explore($first: Int = 24) {
    essays(
      first: $first
      where: { status: PUBLISH, orderby: { field: DATE, order: DESC } }
    ) {
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
          }
        }
        themes {
          nodes {
            slug
          }
        }
      }
    }
    interviews(
      first: $first
      where: { status: PUBLISH, orderby: { field: DATE, order: DESC } }
    ) {
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
          }
        }
        themes {
          nodes {
            slug
          }
        }
      }
    }
    features(
      first: $first
      where: { status: PUBLISH, orderby: { field: DATE, order: DESC } }
    ) {
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

type Response = {
  essays: { nodes: RawNode[] };
  interviews: { nodes: RawNode[] };
  features: { nodes: RawNode[] };
};

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

export async function fetchExplore(perType = 1000): Promise<ExploreItem[]> {
  const data = await wpClient.request<Response>(ExploreQuery, {
    first: perType,
  });

  const items = [
    ...data.essays.nodes.map((n) => toItem(n, "essay")),
    ...data.interviews.nodes.map((n) => toItem(n, "interview")),
    ...data.features.nodes.map((n) => toItem(n, "feature")),
  ];

  items.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return items;
}
