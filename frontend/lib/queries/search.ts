import { gql } from "graphql-request";
import { wpClient } from "../api";
import { rewriteMediaUrl } from "../media";
import type { ExploreItem } from "./explore";
import { fetchPhotographerArticles } from "./photographer-articles";
import { htmlToInlineText } from "../text-utils";
import { resolvePhotographerCredit } from "./recent-essays";

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
      first: 200
      where: { search: $term, status: PUBLISH, orderby: { field: DATE, order: DESC } }
    ) {
      nodes {
        id
        title
        slug
        date
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
    features(
      first: 200
      where: { search: $term, status: PUBLISH, orderby: { field: DATE, order: DESC } }
    ) {
      nodes {
        id
        title
        slug
        date
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

type RawNode = {
  id: string;
  title: string;
  slug: string;
  date: string;
  photographerName: string | null;
  linkedPhotographer: { title: string | null } | null;
  linkedPhotographers: { title: string | null }[] | null;
  featuredImage: {
    node: { sourceUrl: string | null; altText: string | null; mediaDetails?: { width: number | null; height: number | null } | null; } | null;
  } | null;
};

/** A search hit: an Explore item plus its photographer credit, when known. */
export type SearchItem = ExploreItem & { photographer?: string | null };

type Response = {
  essays: { nodes: RawNode[] };
  interviews: { nodes: RawNode[] };
  features: { nodes: RawNode[] };
};

function toItem(
  node: RawNode,
  contentType: ExploreItem["contentType"]
): SearchItem {
  const fi = node.featuredImage?.node;
  const src = fi ? rewriteMediaUrl(fi.sourceUrl) : null;
  return {
    id: node.id,
    title: node.title,
    slug: node.slug,
    date: node.date,
    contentType,
    featuredImage: src ? { src, alt: fi?.altText || node.title, width: fi?.mediaDetails?.width ?? undefined, height: fi?.mediaDetails?.height ?? undefined } : null,
    themes: [],
    photographer: resolvePhotographerCredit(node),
  };
}

const PhotographerSearchQuery = gql`
  query SearchPhotographers($term: String!) {
    photographers(first: 20, where: { search: $term, status: PUBLISH }) {
      nodes {
        id
        title
        slug
        content
        linkedArticleCount
        appearsInCount
        tpjPortraitUrl
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

type RawPhotographer = {
  id: string;
  title: string;
  slug: string;
  content: string | null;
  linkedArticleCount: number | null;
  appearsInCount: number | null;
  tpjPortraitUrl: string | null;
  featuredImage: { node: { sourceUrl: string | null; altText: string | null; mediaDetails?: { width: number | null; height: number | null } | null; } | null } | null;
};

export type SearchPhotographer = {
  id: string;
  name: string;
  slug: string;
  bioPreview: string;
  articleCount: number;
  appearsInCount: number;
  portrait: { src: string; alt: string } | null;
};

export type SearchResults = {
  /** Photographers whose name matches the search. */
  photographers: SearchPhotographer[];
  /** Articles: text matches plus everything the matched photographers shot or appear in. */
  items: SearchItem[];
};

const norm = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export async function fetchSearchResults(term: string): Promise<SearchResults> {
  const trimmed = term.trim();
  if (!trimmed) return { photographers: [], items: [] };

  const [data, people] = await Promise.all([
    wpClient.request<Response>(SearchQuery, { term: trimmed }),
    wpClient
      .request<{ photographers: { nodes: RawPhotographer[] } }>(PhotographerSearchQuery, { term: trimmed })
      .catch(() => ({ photographers: { nodes: [] as RawPhotographer[] } })),
  ]);

  // WordPress search also matches bios, so keep only photographers whose
  // name contains every word searched ("Aaliyah", "Aaliyah Ei").
  const words = norm(trimmed).split(" ").filter(Boolean);
  const matched = (people.photographers?.nodes ?? []).filter((p) => {
    const name = norm(htmlToInlineText(p.title));
    return words.length > 0 && words.every((w) => name.includes(w));
  });

  const photographers: SearchPhotographer[] = matched.slice(0, 6).map((p) => {
    const portraitSrc = rewriteMediaUrl(p.featuredImage?.node?.sourceUrl ?? p.tpjPortraitUrl ?? null);
    const name = htmlToInlineText(p.title);
    const bio = p.content ? htmlToInlineText(p.content) : "";
    return {
      id: p.id,
      name,
      slug: p.slug,
      bioPreview: bio.length > 140 ? bio.slice(0, bio.lastIndexOf(" ", 140)) + "…" : bio,
      articleCount: p.linkedArticleCount ?? 0,
      appearsInCount: p.appearsInCount ?? 0,
      portrait: portraitSrc ? { src: portraitSrc, alt: name } : null,
    };
  });

  const items: SearchItem[] = [
    ...data.essays.nodes.map((n) => toItem(n, "essay")),
    ...data.interviews.nodes.map((n) => toItem(n, "interview")),
    ...data.features.nodes.map((n) => toItem(n, "feature")),
  ];

  // Add what matched photographers shot and appear in, so a name search
  // finds the piece they modeled for even when the text never names them.
  const works = await Promise.all(
    photographers.slice(0, 3).map((p) => fetchPhotographerArticles(p.slug).catch(() => null))
  );
  const seen = new Set(items.map((i) => `${i.contentType}/${i.slug}`));
  works.forEach((w, i) => {
    // Their own work carries their name; pieces they appear in don't
    // have a credit in this payload, so those cards show none.
    const own = new Set(w?.articles ?? []);
    for (const a of [...(w?.articles ?? []), ...(w?.appearsIn ?? [])]) {
      const key = `${a.contentType}/${a.slug}`;
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({
        id: a.id,
        title: a.title,
        slug: a.slug,
        date: a.date,
        contentType: a.contentType,
        featuredImage: a.featuredImage,
        themes: [],
        photographer: own.has(a) ? photographers[i].name : null,
      });
    }
  });

  items.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return { photographers, items };
}
