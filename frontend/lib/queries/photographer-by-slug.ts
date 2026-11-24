import { gql } from "graphql-request";
import { wpClient } from "../api";
import { rewriteMediaUrl } from "../media";
import { htmlToPlainText, titleCaseName } from "../text-utils";

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

function ensureUrl(value: string, fallbackPrefix: string): string {
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("@")) return fallbackPrefix + value.slice(1);
  return fallbackPrefix + value;
}

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
  const out: Photographer["socials"] = [];
  if (s.website) {
    out.push({
      label: "Website",
      href: ensureUrl(s.website, "https://"),
      external: true,
    });
  }
  if (s.instagram) {
    out.push({
      label: "Instagram",
      href: ensureUrl(s.instagram, "https://instagram.com/"),
      external: true,
    });
  }
  if (s.twitter) {
    out.push({
      label: "Twitter",
      href: ensureUrl(s.twitter, "https://twitter.com/"),
      external: true,
    });
  }
  if (s.facebook) {
    out.push({
      label: "Facebook",
      href: ensureUrl(s.facebook, "https://facebook.com/"),
      external: true,
    });
  }
  if (s.flickr) {
    out.push({
      label: "Flickr",
      href: ensureUrl(s.flickr, "https://flickr.com/people/"),
      external: true,
    });
  }
  if (s.tumblr) {
    out.push({
      label: "Tumblr",
      href: ensureUrl(s.tumblr, "https://"),
      external: true,
    });
  }
  if (s.vsco) {
    out.push({
      label: "VSCO",
      href: ensureUrl(s.vsco, "https://vsco.co/"),
      external: true,
    });
  }
  if (s.vimeo) {
    out.push({
      label: "Vimeo",
      href: ensureUrl(s.vimeo, "https://vimeo.com/"),
      external: true,
    });
  }
  if (s.blog) {
    out.push({
      label: "Blog",
      href: ensureUrl(s.blog, "https://"),
      external: true,
    });
  }
  if (s.bluesky) {
    out.push({
      label: "Bluesky",
      href: ensureUrl(s.bluesky, "https://bsky.app/profile/"),
      external: true,
    });
  }
  if (s.threads) {
    out.push({
      label: "Threads",
      href: ensureUrl(s.threads, "https://www.threads.net/@"),
      external: true,
    });
  }
  if (s.linkedin) {
    out.push({
      label: "LinkedIn",
      href: ensureUrl(s.linkedin, "https://linkedin.com/in/"),
      external: true,
    });
  }
  return out;
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
