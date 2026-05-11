import { gql } from "graphql-request";
import { wpClient } from "../api";
import { rewriteMediaUrl } from "../media";
import { htmlToInlineText } from "../text-utils";
import { resolvePhotographerCredit, type RecentEssay } from "./recent-essays";

const RecentInterviewsQuery = gql`
  query RecentInterviews($first: Int = 6) {
    interviews(
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

type Response = { interviews: { nodes: Raw[] } };

function cleanExcerpt(html: string | null): string | null {
  if (!html) return null;
  const cleaned = htmlToInlineText(html)
    .replace(/\[…\]/g, "")
    .replace(/Continue reading.*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || null;
}

export async function fetchRecentInterviews(
  first = 6
): Promise<RecentEssay[]> {
  const data = await wpClient.request<Response>(RecentInterviewsQuery, {
    first,
  });
  return data.interviews.nodes.map((node): RecentEssay => {
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
