import { gql } from "graphql-request";
import { wpClient } from "../api";
import { rewriteMediaUrl } from "../media";
import type { ExploreItem } from "./explore";

const SearchQuery = gql`
  query Search($term: String!) {
    essays(
      first: 200
      where: { search: $term, status: PUBLISH, orderby: { field: DATE, order: DESC } }
    ) {
      nodes {
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
      }
    }
    interviews(
      first: 200
      where: { search: $term, status: PUBLISH, orderby: { field: DATE, order: DESC } }
    ) {
      nodes {
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
      }
    }
    features(
      first: 200
      where: { search: $term, status: PUBLISH, orderby: { field: DATE, order: DESC } }
    ) {
      nodes {
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
      }
    }
  }
`;

type RawNode = {
  id: string;
  title: string;
  slug: string;
  date: string;
  featuredImage: {
    node: { sourceUrl: string | null; altText: string | null } | null;
  } | null;
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
  return {
    id: node.id,
    title: node.title,
    slug: node.slug,
    date: node.date,
    contentType,
    featuredImage: src ? { src, alt: fi?.altText || node.title } : null,
    themes: [],
  };
}

export async function fetchSearchResults(term: string): Promise<ExploreItem[]> {
  const trimmed = term.trim();
  if (!trimmed) return [];

  const data = await wpClient.request<Response>(SearchQuery, { term: trimmed });

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
