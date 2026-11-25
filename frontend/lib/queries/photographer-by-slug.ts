import { gql } from "graphql-request";
import { wpClient } from "../api";
import { rewriteMediaUrl } from "../media";
import { htmlToPlainText, titleCaseName } from "../text-utils";
import { buildSocialLinks } from "../social-links";

const PhotographerBySlugQuery = gql`
  query PhotographerBySlug($slug: ID!) {
    photographer(id: $slug, idType: SLUG) {
      id
      title
      slug
      content
      interviewCount
      tpjPortraitUrl
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
      location
      representedBy
      featuredImage {
        node {
          sourceUrl
          altText
        }
      }
    }
  }
`;



export type Photographer = {
  id: string;
  name: string;
  slug: string;
  bio: string;
  interviewCount: number;
  location: string | null;
  representedBy: string | null;
  socials: { label: string; href: string; external: boolean }[];
  portrait: { src: string; alt: string } | null;
};

type Raw = {
  id: string;
  title: string;
  slug: string;
  content: string | null;
  interviewCount: number | null;
  tpjPortraitUrl: string | null;
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
  location: string | null;
  representedBy: string | null;
  featuredImage: {
    node: { sourceUrl: string | null; altText: string | null } | null;
  } | null;
};

type Response = { photographer: Raw | null };




// Bio rendering for the photographer detail page goes through the
// shared `htmlToPlainText` so HTML entities (curly quotes, en/em dashes,
// ampersands, etc.) decode to their Unicode characters and don't show
// through as literal `&#8217;` strings.

type SocialFields = {
  website: string | null;
  instagram: string | null;
  twitter: string | null;
  facebook: string | null;
  tumblr: string | null;
  flickr: string | null;
  vsco: string | null;
  vimeo: string | null;
  blog: string | null;
  bluesky: string | null;
  threads: string | null;
  linkedin: string | null;
};

function buildSocials(s: SocialFields): Photographer["socials"] {
  return buildSocialLinks(s);
}

function resolvePortrait(
  fi: { sourceUrl: string | null; altText: string | null } | null | undefined,
  fallbackUrl: string | null,
  altFallback: string
): { src: string; alt: string } | null {
  const featuredSrc = fi ? rewriteMediaUrl(fi.sourceUrl) : null;
  if (featuredSrc) return { src: featuredSrc, alt: fi?.altText || altFallback };
  const fromBlob = fallbackUrl ? rewriteMediaUrl(fallbackUrl) : null;
  if (fromBlob) return { src: fromBlob, alt: altFallback };
  return null;
}


export async function fetchPhotographerBySlug(
  slug: string
): Promise<Photographer | null> {
  const data = await wpClient.request<Response>(PhotographerBySlugQuery, {
    slug,
  });
  const raw = data.photographer;
  // Every listed photographer has a record (510/510, checked
  // 2026-11-24). Unknown slugs are a 404, not an archive-wide scan.
  if (!raw) return null;

  return {
    id: raw.id,
    name: titleCaseName(raw.title),
    slug: raw.slug,
    bio: raw.content ? htmlToPlainText(raw.content) : "",
    interviewCount: raw.interviewCount ?? 0,
    location: raw.location ?? null,
    representedBy: raw.representedBy ?? null,
    socials: buildSocials({
      website: raw.website,
      instagram: raw.instagram,
      twitter: raw.twitter,
      facebook: raw.facebook,
      tumblr: raw.tumblr,
      flickr: raw.flickr,
      vsco: raw.vscoGrid,
      vimeo: raw.vimeo,
      blog: raw.blog,
      bluesky: raw.bluesky,
      threads: raw.threads,
      linkedin: raw.linkedin,
    }),
    portrait: resolvePortrait(
      raw.featuredImage?.node ?? null,
      raw.tpjPortraitUrl,
      raw.title
    ),
  };
}
