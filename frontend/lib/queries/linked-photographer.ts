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

/** A credit line: "Model:", "Styling:", "Hair & Makeup:", "Assistance & Moral Support:"... */
const CREDIT_LINE =
  /^(?:credits?\s*:?\s*)?(?:models?|muses?|styl(?:ing|ist|ists|ed by)|hair|make[- ]?up|mua|talent|props?|lighting|video(?:graphy| by)?|wardrobe|assist(?:ant|ants|ance|ed by)?|casting|retouch(?:ing|er)?|(?:art |creative )?direction|creative director|art director|producers?|production|grooming|set design|nails|jewel(?:le)?ry|special thanks|thanks to|featuring|locations?|clothing|shot on)\b[^:]{0,40}:/i;

const BLOCK_BREAK =
  /<\/?(?:p|div|h[1-6]|li|ul|ol|blockquote|figure|section|span)\b[^>]*>|<br\s*\/?>/gi;

function creditText(segment: string): string {
  return segment
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/** Keep only links (href) from a credit segment; drop unbalanced markup. */
function cleanCreditHtml(segment: string): string {
  const kept = segment
    .replace(/<a\b[^>]*?href\s*=\s*("[^"]*"|'[^']*')[^>]*>/gi, '<a href=$1 target="_blank" rel="noopener">')
    .replace(/<(?!\/?a\b)[^>]+>/gi, "")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const opens = (kept.match(/<a\b/gi) ?? []).length;
  const closes = (kept.match(/<\/a>/gi) ?? []).length;
  return opens === closes ? kept : kept.replace(/<[^>]+>/g, "");
}

/** Credit lines (model, styling, hair...) found after the legacy bio block. */
export function extractLegacyCredits(tail: string): string[] {
  const out: string[] = [];
  // After a label with nothing beside it ("Models:"), the names follow
  // on their own short lines.
  let follow = 0;
  for (const seg of tail.split(BLOCK_BREAK)) {
    const text = creditText(seg);
    if (!text) continue;
    if (CREDIT_LINE.test(text)) {
      out.push(cleanCreditHtml(seg));
      follow = /:$/.test(text) ? 12 : 0;
    } else if (follow > 0 && text.length <= 100 && !/:$/.test(text)) {
      out.push(cleanCreditHtml(seg));
      follow--;
    } else {
      follow = 0;
    }
  }
  return out.filter(Boolean);
}

/** Index of the first colon outside markup (an href's "https:" doesn't count). */
function labelColon(html: string): number {
  let inTag = false;
  for (let i = 0; i < html.length; i++) {
    const c = html[i];
    if (c === "<") inTag = true;
    else if (c === ">") inTag = false;
    else if (c === ":" && !inTag) return i;
  }
  return -1;
}

type CreditEntry = { label: string; values: string[] };

/**
 * Group credit lines into label/value pairs for the colophon. Each line
 * splits on its first colon: "Model: Clair Banks" -> Model / Clair Banks.
 * A line with no label (a name under a bare "Models:" heading) joins the
 * preceding label's values, one per line. "Clothing by:" reads as
 * "Clothing"; a leading "Credits:" is dropped.
 */
export function groupCredits(lines: string[]): CreditEntry[] {
  const out: CreditEntry[] = [];
  for (const raw of lines) {
    // "Images 1 & 8 –<a>Name</a>": give the dash its space back.
    let line = raw.replace(/([–—])(?=<a\b)/g, "$1 ").trim();
    let at = labelColon(line);
    let label = at === -1 ? "" : creditText(line.slice(0, at));
    if (/^credits?$/i.test(label)) {
      line = line.slice(at + 1).trim();
      at = labelColon(line);
      label = at === -1 ? "" : creditText(line.slice(0, at));
    }
    // A long "label" is a sentence with a colon in it, not a label.
    if (label && label.length <= 40) {
      const value = line.slice(at + 1).trim();
      out.push({
        label: label.replace(/\s+by$/i, ""),
        values: value && creditText(value) ? [value] : [],
      });
    } else if (out.length > 0) {
      out[out.length - 1].values.push(line);
    } else {
      out.push({ label: "", values: [line] });
    }
  }
  return out.filter((e) => e.values.length > 0);
}

function escapeText(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Credit lines as a definition list: <dt>Model</dt><dd>Clair Banks</dd>. */
export function creditsToDefinitionList(lines: string[]): string {
  const entries = groupCredits(lines);
  if (entries.length === 0) return "";
  const rows = entries
    .map(
      (e) =>
        // Names under one label read as one line: "A, B, C".
        `<div><dt>${escapeText(e.label)}</dt><dd>${e.values.join(", ")}</dd></div>`
    )
    .join("");
  return `<dl class="article-credits">${rows}</dl>`;
}

/**
 * Strip the legacy photographer block (everything from
 * `<div class="circletar"></div>` to end of content) so the structured
 * Photographer card at the bottom of the article isn't visually duplicated
 * by the inline blob. Only stripped when we have a linked photographer
 * to display in its place. Credit lines in that block (model, styling,
 * hair...) are kept and re-added as a colophon: a definition list of
 * label / name pairs.
 */
export function stripPhotographerBlob(html: string): string {
  const idx = html.toLowerCase().indexOf('<div class="circletar"');
  if (idx === -1) return html;
  const before = html.slice(0, idx);
  const trimmed = before.replace(
    /(?:\s|<p[^>]*>\s*(?:&nbsp;| )?\s*<\/p>)+$/i,
    ""
  );
  const dl = creditsToDefinitionList(extractLegacyCredits(html.slice(idx)));
  return html.slice(0, trimmed.length) + (dl ? `\n${dl}` : "");
}
