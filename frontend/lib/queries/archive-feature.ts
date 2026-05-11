import { gql } from "graphql-request";
import { wpClient } from "../api";
import { rewriteMediaUrl } from "../media";
import { htmlToInlineText } from "../text-utils";
import type { FeaturedImage } from "./recent-essays";

/**
 * Fetches a candidate pool of essays/interviews/features published more
 * than two years ago and returns one at random. Used for the homepage
 * "From the Archive" card that sits next to the photographer spotlight.
 */

const ArchiveCandidatesQuery = gql`
  query ArchiveCandidates(
    $before: DateInput!
    $essaysFirst: Int = 200
    $interviewsFirst: Int = 100
    $featuresFirst: Int = 50
  ) {
    essays(
      first: $essaysFirst
      where: {
        status: PUBLISH
        dateQuery: { before: $before }
        orderby: { field: DATE, order: DESC }
      }
    ) {
      nodes {
        id
        title
        slug
        date
        excerpt
        featuredImage {
          node {
            sourceUrl
            altText
          }
        }
      }
    }
    interviews(
      first: $interviewsFirst
      where: {
        status: PUBLISH
        dateQuery: { before: $before }
        orderby: { field: DATE, order: DESC }
      }
    ) {
      nodes {
        id
        title
        slug
        date
        excerpt
        featuredImage {
          node {
            sourceUrl
            altText
          }
        }
      }
    }
    features(
      first: $featuresFirst
      where: {
        status: PUBLISH
        dateQuery: { before: $before }
        orderby: { field: DATE, order: DESC }
      }
    ) {
      nodes {
        id
        title
        slug
        date
        excerpt
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

export type ArchiveFeatureType = "essay" | "interview" | "feature";

export type ArchiveFeature = {
  id: string;
  title: string;
  slug: string;
  date: string;
  excerpt: string | null;
  featuredImage: FeaturedImage | null;
  type: ArchiveFeatureType;
  href: string;
};

type RawNode = {
  id: string;
  title: string;
  slug: string;
  date: string;
  excerpt: string | null;
  featuredImage: {
    node: { sourceUrl: string | null; altText: string | null } | null;
  } | null;
};

type Response = {
  essays: { nodes: RawNode[] };
  interviews: { nodes: RawNode[] };
  features: { nodes: RawNode[] };
};

function cleanExcerpt(html: string | null): string | null {
  if (!html) return null;
  const cleaned = htmlToInlineText(html)
    .replace(/\[…\]/g, "")
    .replace(/Continue reading.*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || null;
}

function toFeature(node: RawNode, type: ArchiveFeatureType): ArchiveFeature {
  const fi = node.featuredImage?.node;
  const src = fi ? rewriteMediaUrl(fi.sourceUrl) : null;
  return {
    id: node.id,
    title: node.title,
    slug: node.slug,
    date: node.date,
    excerpt: cleanExcerpt(node.excerpt),
    featuredImage: src
      ? { src, alt: fi?.altText || node.title }
      : null,
    type,
    href: `/${type}/${node.slug}`,
  };
}

export async function fetchArchiveFeature(): Promise<ArchiveFeature | null> {
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - 2);
  const before = {
    year: cutoff.getFullYear(),
    month: cutoff.getMonth() + 1,
    day: cutoff.getDate(),
  };

  const data = await wpClient.request<Response>(ArchiveCandidatesQuery, {
    before,
  });

  const pool: ArchiveFeature[] = [
    ...data.essays.nodes.map((n) => toFeature(n, "essay")),
    ...data.interviews.nodes.map((n) => toFeature(n, "interview")),
    ...data.features.nodes.map((n) => toFeature(n, "feature")),
  ].filter((f) => f.featuredImage);

  if (pool.length === 0) return null;

  return pool[Math.floor(Math.random() * pool.length)];
}
