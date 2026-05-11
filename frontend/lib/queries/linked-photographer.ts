import { gql } from "graphql-request";
import { rewriteMediaUrl } from "../media";
import { htmlToInlineText, slugifyName, titleCaseName } from "../text-utils";
import type { Photographer } from "@/lib/photographer-types";

export const LinkedPhotographerFields = gql`
  linkedPhotographer {
    id
    title
    slug
    content
    tpjPortraitUrl
    linkedArticleCount
    website
    instagram
    twitter
    facebook
    tumblr
    flickr
    vscoGrid
    vimeo
    blog
    bluesky
    threads
    linkedin
    featuredImage {
      node {
        sourceUrl
        altText
      }
    }
  }
`;

/**
 * Plural counterpart to LinkedPhotographerFields. Returns every linked
 * Photographer CPT for the article (one per credited photographer) so
 * collaboration credits render a card for each contributor instead of
 * collapsing to the primary. Same field shape as the singular fragment,
 * keyed under `linkedPhotographers` (array).
 */
export const LinkedPhotographersFields = gql`
  linkedPhotographers {
    id
    title
    slug
    content
    tpjPortraitUrl
    linkedArticleCount
    website
    instagram
    twitter
    facebook
    tumblr
    flickr
    vscoGrid
    vimeo
    blog
    bluesky
    threads
    linkedin
    featuredImage {
      node {
        sourceUrl
        altText
      }
    }
  }
`;

export type RawLinkedPhotographer = {
  id: string;
  title: string;
  slug: string;
  content: string | null;
  tpjPortraitUrl: string | null;
  linkedArticleCount: number | null;
  website: string | null;
  instagram: string | null;
  twitter: string | null;
  facebook: string | null;
  tumblr: string | null;
  flickr: string | null;
  vscoGrid: string | null;
  vimeo: string | null;
  blog: string | null;
  bluesky: string | null;
  threads: string | null;
  linkedin: string | null;
  featuredImage: {
    node: { sourceUrl: string | null; altText: string | null } | null;
  } | null;
};

export function rawLinkedPhotographerToPhotographer(
  raw: RawLinkedPhotographer
): Photographer {
  const fi = raw.featuredImage?.node;
  const featuredSrc = fi ? rewriteMediaUrl(fi.sourceUrl) : null;
  const portraitFromBlob = raw.tpjPortraitUrl
    ? rewriteMediaUrl(raw.tpjPortraitUrl)
    : null;

  const portraitSrc = featuredSrc ?? portraitFromBlob;

  const bio = htmlToInlineText(raw.content);

  const name = titleCaseName(raw.title);
  return {
    name,
    slug: raw.slug,
    bio,
    articleCount: raw.linkedArticleCount ?? 0,
    portrait: portraitSrc ? { src: portraitSrc, alt: name } : undefined,
  };
}

/**
 * Build a minimal Photographer object for an article whose
 * `linkedPhotographer` is null but `photographerName` is set. The slug
 * is derived deterministically from the name so the card can route to
 * `/photographer/<slug>`, which the detail page resolves via its own
 * name-based fallback. Article count is left at 0 because we don't
 * know it from the article context; the card omits the count line.
 */
export function buildPhantomPhotographer(name: string): Photographer {
  return {
    name: titleCaseName(name),
    slug: slugifyName(name),
    bio: undefined,
    articleCount: 0,
    portrait: undefined,
  };
}

/**
 * Resolve the article's photographer list, preferring the plural CPT
 * field when present. Falls back to the singular for legacy data, then
 * to a phantom built from `photographerName` if no CPT is linked at
 * all. The returned array is guaranteed non-null when any signal
 * exists, and is empty otherwise.
 *
 * The displayed credit string (`photographerName`) may be a joined
 * "X & Y" for collaborations; for phantoms we split it back into
 * separate entries so each name gets its own card. Single-name
 * articles stay one entry.
 */
export function resolveArticlePhotographers(input: {
  linkedPhotographers: RawLinkedPhotographer[] | null;
  linkedPhotographer: RawLinkedPhotographer | null;
  photographerName: string | null;
}): Photographer[] {
  const list = input.linkedPhotographers ?? [];
  if (list.length > 0) {
    return list.map(rawLinkedPhotographerToPhotographer);
  }
  if (input.linkedPhotographer) {
    return [rawLinkedPhotographerToPhotographer(input.linkedPhotographer)];
  }
  const name = input.photographerName?.trim();
  if (!name) return [];
  // Phantom path: caller has a credit string but no CPT yet. Split on
  // the same conjunctions the WP resolver uses so collaborations still
  // produce one card per contributor instead of a single combined slug.
  const parts = name
    .split(/\s*(?:&|,|;|\s+and\s+)\s*/i)
    .map((p) => p.trim())
    .filter(Boolean);
  const names = parts.length > 0 ? parts : [name];
  return names.map(buildPhantomPhotographer);
}

/**
 * Strip the legacy photographer block (everything from
 * `<div class="circletar"></div>` to end of content) so the structured
 * Photographer card at the bottom of the article isn't visually duplicated
 * by the inline blob. Only stripped when we have a linked photographer
 * to display in its place.
 */
export function stripPhotographerBlob(html: string): string {
  const idx = html.toLowerCase().indexOf('<div class="circletar"');
  if (idx === -1) return html;
  const before = html.slice(0, idx);
  const trimmed = before.replace(
    /(?:\s|<p[^>]*>\s*(?:&nbsp;| )?\s*<\/p>)+$/i,
    ""
  );
  return html.slice(0, trimmed.length);
}
