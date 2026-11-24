import { gql } from "graphql-request";
import { wpClient } from "../api";
import { rewriteMediaUrl } from "../media";

// One photographer's work, resolved in WordPress by the tpj_photographer
// link (inc/graphql.php → photographerWork). Replaces pulling all ~755
// articles and filtering here, which took ~5s per cold photographer page.
const PhotographerWorkQuery = gql`
  query PhotographerWork($slug: String!) {
    photographerWork(slug: $slug) {
      essays {
        id
        title
        slug
        date
        photographerName
        articleAuthor
        featuredImage {
          node {
            sourceUrl
            altText
            mediaDetails { width height }
          }
        }
      }
      interviews {
        id
        title
        slug
        date
        photographerName
        articleAuthor
        featuredImage {
          node {
            sourceUrl
            altText
            mediaDetails { width height }
          }
        }
      }
      features {
        id
        title
        slug
        date
        photographerName
        articleAuthor
        featuredImage {
          node {
            sourceUrl
            altText
            mediaDetails { width height }
          }
        }
      }
      interviewsConducted {
        id
        title
        slug
        date
        photographerName
        articleAuthor
        featuredImage {
          node {
            sourceUrl
            altText
            mediaDetails { width height }
          }
        }
      }
      appearsInEssays {
        id
        title
        slug
        date
        photographerName
        articleAuthor
        featuredImage {
          node {
            sourceUrl
            altText
            mediaDetails { width height }
          }
        }
      }
      appearsInInterviews {
        id
        title
        slug
        date
        photographerName
        articleAuthor
        featuredImage {
          node {
            sourceUrl
            altText
            mediaDetails { width height }
          }
        }
      }
      appearsInFeatures {
        id
        title
        slug
        date
        photographerName
        articleAuthor
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

export type PhotographerArticleType = "essay" | "interview" | "feature";

export type PhotographerArticle = {
  id: string;
  title: string;
  slug: string;
  date: string;
  contentType: PhotographerArticleType;
  featuredImage: { src: string; alt: string; width?: number; height?: number } | null;
};

type RawNode = {
  id: string;
  title: string;
  slug: string;
  date: string;
  photographerName: string | null;
  featuredImage: {
    node: { sourceUrl: string | null; altText: string | null; mediaDetails?: { width: number | null; height: number | null } | null; } | null;
  } | null;
  linkedPhotographers: { slug: string | null }[] | null;
  articleAuthor?: string | null;
};

type WorkResponse = {
  photographerWork: {
    essays: RawNode[] | null;
    interviews: RawNode[] | null;
    features: RawNode[] | null;
    interviewsConducted: RawNode[] | null;
    appearsInEssays?: RawNode[] | null;
    appearsInInterviews?: RawNode[] | null;
    appearsInFeatures?: RawNode[] | null;
  } | null;
};


function toArticle(
  node: RawNode,
  contentType: PhotographerArticleType
): PhotographerArticle {
  const fi = node.featuredImage?.node;
  const src = fi ? rewriteMediaUrl(fi.sourceUrl) : null;
  return {
    id: node.id,
    title: node.title,
    slug: node.slug,
    date: node.date,
    contentType,
    featuredImage: src
      ? { src, alt: fi?.altText || node.title, width: fi?.mediaDetails?.width ?? undefined, height: fi?.mediaDetails?.height ?? undefined }
      : null,
  };
}

/**
 * Fetches every essay, interview, and feature in TPJ associated with
 * the given photographer slug. Matches if the photographer's slug
 * appears in the article's `linkedPhotographers` list (so co-credited
 * collaborators see the article on their profile too), falling back to
 * a slugified `photographerName` so contributors with no migrated CPT
 * record still have working detail pages.
 */
export type PhotographerWork = {
  /** Articles that credit this person as the photographer. */
  articles: PhotographerArticle[];
  /** Interviews this person conducted (matched on the interviewer byline). */
  interviewsConducted: PhotographerArticle[];
  /** Pieces someone else shot that this person appears in (model, subject). */
  appearsIn: PhotographerArticle[];
};


export async function fetchPhotographerArticles(
  photographerSlug: string
): Promise<PhotographerWork> {
  const data = await wpClient.request<WorkResponse>(PhotographerWorkQuery, {
    slug: photographerSlug,
  });
  const w = data.photographerWork;
  if (!w) return { articles: [], interviewsConducted: [], appearsIn: [] };

  const byDateDesc = (a: PhotographerArticle, b: PhotographerArticle) =>
    new Date(b.date).getTime() - new Date(a.date).getTime();
  const articles = [
    ...(w.essays ?? []).map((n) => toArticle(n, "essay")),
    ...(w.interviews ?? []).map((n) => toArticle(n, "interview")),
    ...(w.features ?? []).map((n) => toArticle(n, "feature")),
  ].sort(byDateDesc);
  const interviewsConducted = (w.interviewsConducted ?? [])
    .map((n) => toArticle(n, "interview"))
    .sort(byDateDesc);
  const appearsIn = [
    ...(w.appearsInEssays ?? []).map((n) => toArticle(n, "essay")),
    ...(w.appearsInInterviews ?? []).map((n) => toArticle(n, "interview")),
    ...(w.appearsInFeatures ?? []).map((n) => toArticle(n, "feature")),
  ].sort(byDateDesc);
  return { articles, interviewsConducted, appearsIn };
}
