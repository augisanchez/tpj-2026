import { gql } from "graphql-request";
import { wpClient } from "../api";
import { rewriteMediaUrl } from "../media";
import { htmlToInlineText, titleCaseName } from "../text-utils";
import type { Photographer } from "@/lib/photographer-types";

/**
 * Pull a photographer with real content for the homepage spotlight.
 * Candidates need: a bio, at least two linked articles (so the "View
 * all N articles" CTA leads somewhere), and an own-portrait image —
 * either a featuredImage on the photographer record or a tpjPortraitUrl
 * meta value. Photographers without a real portrait are excluded from
 * the spotlight entirely (the editorial intent is "this is the person",
 * not a placeholder or one of their photographs standing in for them).
 * Among qualifying candidates we pick from the top five most-prolific
 * so the spotlight rotates instead of always landing on the same
 * person.
 */
const SpotlightQuery = gql`
  query SpotlightPhotographer {
    photographers(first: 200, where: { status: PUBLISH }) {
      nodes {
        id
        title
        slug
        content
        tpjPortraitUrl
        linkedArticleCount
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

type Raw = {
  id: string;
  title: string;
  slug: string;
  content: string | null;
  tpjPortraitUrl: string | null;
  linkedArticleCount: number | null;
  featuredImage: {
    node: { sourceUrl: string | null; altText: string | null } | null;
  } | null;
};

type Response = { photographers: { nodes: Raw[] } };


function resolvePortrait(raw: Raw): { src: string; alt: string } | null {
  const fi = raw.featuredImage?.node;
  const featuredSrc = fi ? rewriteMediaUrl(fi.sourceUrl) : null;
  if (featuredSrc) return { src: featuredSrc, alt: fi?.altText || raw.title };

  const fromBlob = raw.tpjPortraitUrl
    ? rewriteMediaUrl(raw.tpjPortraitUrl)
    : null;
  if (fromBlob) return { src: fromBlob, alt: raw.title };

  return null;
}

export async function fetchSpotlightPhotographer(): Promise<Photographer | null> {
  const data = await wpClient.request<Response>(SpotlightQuery);
  const nodes = data.photographers?.nodes ?? [];
  if (nodes.length === 0) return null;

  const candidates = nodes
    .map((raw) => {
      const portrait = resolvePortrait(raw);
      const bio = htmlToInlineText(raw.content);
      const articleCount = raw.linkedArticleCount ?? 0;
      return { raw, portrait, bio, articleCount };
    })
    .filter(
      (c) => c.portrait !== null && c.bio.length > 0 && c.articleCount >= 2
    );

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => b.articleCount - a.articleCount);
  const top = candidates.slice(0, 5);
  const winner = top[Math.floor(Math.random() * top.length)];

  const trimmedBio =
    winner.bio.length > 280
      ? winner.bio.slice(0, 277).trimEnd() + "…"
      : winner.bio;

  return {
    name: titleCaseName(winner.raw.title),
    slug: winner.raw.slug,
    bio: trimmedBio,
    articleCount: winner.articleCount,
    portrait: winner.portrait ?? undefined,
  };
}
