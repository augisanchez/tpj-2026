import { gql } from "graphql-request";
import { wpClient } from "../api";
import { rewriteMediaUrl } from "../media";
import { htmlToInlineText } from "../text-utils";
import { resolvePhotographerCredit } from "./recent-essays";
import type { RecentArticle } from "./recent-articles";

const ArchivalArticlesQuery = gql`
  query ArchivalArticles(
    $first: Int = 80
    $beforeYear: Int!
    $beforeMonth: Int!
    $beforeDay: Int!
  ) {
    essays(
      first: $first
      where: {
        status: PUBLISH
        orderby: { field: DATE, order: DESC }
        dateQuery: { before: { year: $beforeYear, month: $beforeMonth, day: $beforeDay } }
      }
    ) {
      nodes {
        id
        title
        slug
        date
        excerpt
        photographerName
        linkedPhotographer { title }
        linkedPhotographers { title }
        featuredImage {
          node {
            sourceUrl
            altText
            mediaDetails { width height }
          }
        }
      }
    }
    interviews(
      first: $first
      where: {
        status: PUBLISH
        orderby: { field: DATE, order: DESC }
        dateQuery: { before: { year: $beforeYear, month: $beforeMonth, day: $beforeDay } }
      }
    ) {
      nodes {
        id
        title
        slug
        date
        excerpt
        photographerName
        linkedPhotographer { title }
        linkedPhotographers { title }
        featuredImage {
          node {
            sourceUrl
            altText
            mediaDetails { width height }
          }
        }
      }
    }
  }
`;

type Raw = {
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
  essays: { nodes: Raw[] };
  interviews: { nodes: Raw[] };
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

function toArticle(
  node: Raw,
  contentType: "essay" | "interview"
): RecentArticle {
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
    contentType,
  };
}

/**
 * Articles older than ~2 years, used by the homepage Dive Deeper section
 * to pull featured cards from the deeper archive instead of the recent
 * feed. Recent essays often surface in the Keep Exploring row and the
 * ThemeBrowser groups simultaneously; pulling from older content avoids
 * showing the same featured image in two adjacent sections.
 */
export async function fetchArchivalArticles(
  firstPerType = 80,
  yearsAgo = 2
): Promise<RecentArticle[]> {
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - yearsAgo);
  const data = await wpClient.request<Response>(ArchivalArticlesQuery, {
    first: firstPerType,
    beforeYear: cutoff.getFullYear(),
    beforeMonth: cutoff.getMonth() + 1,
    beforeDay: cutoff.getDate(),
  });
  return [
    ...data.essays.nodes.map((n) => toArticle(n, "essay")),
    ...data.interviews.nodes.map((n) => toArticle(n, "interview")),
  ];
}
