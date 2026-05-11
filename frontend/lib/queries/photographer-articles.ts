import { gql } from "graphql-request";
import { wpClient } from "../api";
import { rewriteMediaUrl } from "../media";
import { slugifyName } from "../text-utils";

const PhotographerArticlesQuery = gql`
  query PhotographerArticles($first: Int = 1000) {
    essays(
      first: $first
      where: { status: PUBLISH, orderby: { field: DATE, order: DESC } }
    ) {
      nodes {
        id
        title
        slug
        date
        photographerName
        featuredImage {
          node {
            sourceUrl
            altText
          }
        }
        linkedPhotographers {
          slug
        }
      }
    }
    interviews(
      first: $first
      where: { status: PUBLISH, orderby: { field: DATE, order: DESC } }
    ) {
      nodes {
        id
        title
        slug
        date
        photographerName
        featuredImage {
          node {
            sourceUrl
            altText
          }
        }
        linkedPhotographers {
          slug
        }
      }
    }
    features(
      first: $first
      where: { status: PUBLISH, orderby: { field: DATE, order: DESC } }
    ) {
      nodes {
        id
        title
        slug
        date
        photographerName
        featuredImage {
          node {
            sourceUrl
            altText
          }
        }
        linkedPhotographers {
          slug
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
  featuredImage: { src: string; alt: string } | null;
};

type RawNode = {
  id: string;
  title: string;
  slug: string;
  date: string;
  photographerName: string | null;
  featuredImage: {
    node: { sourceUrl: string | null; altText: string | null } | null;
  } | null;
  linkedPhotographers: { slug: string | null }[] | null;
};

type Response = {
  essays: { nodes: RawNode[] };
  interviews: { nodes: RawNode[] };
  features: { nodes: RawNode[] };
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
      ? { src, alt: fi?.altText || node.title }
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
export async function fetchPhotographerArticles(
  photographerSlug: string
): Promise<PhotographerArticle[]> {
  const data = await wpClient.request<Response>(PhotographerArticlesQuery, {
    first: 1000,
  });

  const matches = (n: RawNode) => {
    if (n.linkedPhotographers?.some((lp) => lp.slug === photographerSlug)) {
      return true;
    }
    if (n.photographerName) {
      // Multi-author phantom path: split the joined display name on the
      // same conjunctions the WP resolver uses, slugify each, and
      // match. Lets pre-CPT collaborations still resolve per name.
      const parts = n.photographerName
        .split(/\s*(?:&|,|;|\s+and\s+)\s*/i)
        .map((p) => p.trim())
        .filter(Boolean);
      const candidates = parts.length > 0 ? parts : [n.photographerName];
      if (candidates.some((p) => slugifyName(p) === photographerSlug)) {
        return true;
      }
    }
    return false;
  };

  const articles = [
    ...data.essays.nodes.filter(matches).map((n) => toArticle(n, "essay")),
    ...data.interviews.nodes
      .filter(matches)
      .map((n) => toArticle(n, "interview")),
    ...data.features.nodes
      .filter(matches)
      .map((n) => toArticle(n, "feature")),
  ];

  articles.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  return articles;
}
