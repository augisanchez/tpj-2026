import { gql } from "graphql-request";
import { wpClient } from "../api";
import { rewriteMediaUrl } from "../media";
import { htmlToPlainText, slugifyName, titleCaseName } from "../text-utils";

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
      featuredImage {
        node {
          sourceUrl
          altText
        }
      }
    }
  }
`;

/**
 * Fallback path used when the Photographer CPT is empty (the
 * `wp tpj migrate-photographers` step hasn't run yet). The
 * `linkedPhotographer` field on every article carries the same data we
 * need, so we aggregate the photographer's record from any article
 * linked to them.
 */
const ArticlesWithFullPhotographerQuery = gql`
  query ArticlesWithFullPhotographer($first: Int = 500) {
    essays(first: $first, where: { status: PUBLISH }) {
      nodes {
        id
        photographerName
        featuredImage {
          node {
            sourceUrl
            altText
          }
        }
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
          featuredImage {
            node {
              sourceUrl
              altText
            }
          }
        }
      }
    }
    interviews(first: $first, where: { status: PUBLISH }) {
      nodes {
        id
        photographerName
        featuredImage {
          node {
            sourceUrl
            altText
          }
        }
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
          featuredImage {
            node {
              sourceUrl
              altText
            }
          }
        }
      }
    }
    features(first: $first, where: { status: PUBLISH }) {
      nodes {
        id
        photographerName
        featuredImage {
          node {
            sourceUrl
            altText
          }
        }
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
          featuredImage {
            node {
              sourceUrl
              altText
            }
          }
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
  featuredImage: {
    node: { sourceUrl: string | null; altText: string | null } | null;
  } | null;
};

type Response = { photographer: Raw | null };

type LinkedRaw = {
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

type FallbackNode = {
  id: string;
  photographerName: string | null;
  featuredImage: {
    node: { sourceUrl: string | null; altText: string | null } | null;
  } | null;
  linkedPhotographer: LinkedRaw | null;
};

type FallbackResponse = {
  essays: { nodes: FallbackNode[] };
  interviews: { nodes: FallbackNode[] };
  features: { nodes: FallbackNode[] };
};

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

async function derivePhotographerFromArticles(
  slug: string
): Promise<Photographer | null> {
  const data = await wpClient.request<FallbackResponse>(
    ArticlesWithFullPhotographerQuery,
    { first: 500 }
  );

  let lp: LinkedRaw | null = null;
  let phantomName: string | null = null;
  let phantomArticleImage: {
    sourceUrl: string | null;
    altText: string | null;
  } | null = null;
  let count = 0;

  const collect = (nodes: FallbackNode[]) => {
    for (const n of nodes) {
      const linked = n.linkedPhotographer;
      const matchesLinked = linked && linked.slug === slug;
      const matchesName =
        n.photographerName && slugifyName(n.photographerName) === slug;

      if (!matchesLinked && !matchesName) continue;

      if (matchesLinked) {
        if (!lp) lp = linked;
      } else if (n.photographerName) {
        if (!phantomName) phantomName = n.photographerName;
        if (!phantomArticleImage && n.featuredImage?.node) {
          phantomArticleImage = n.featuredImage.node;
        }
      }
      count += 1;
    }
  };

  collect(data.essays?.nodes ?? []);
  collect(data.interviews?.nodes ?? []);
  collect(data.features?.nodes ?? []);

  if (lp) {
    const found: LinkedRaw = lp;
    return {
      id: found.id,
      name: titleCaseName(found.title),
      slug: found.slug,
      bio: found.content ? htmlToPlainText(found.content) : "",
      interviewCount: count,
      socials: buildSocials({
        website: found.website,
        instagram: found.instagram,
        twitter: found.twitter,
        facebook: found.facebook,
        tumblr: found.tumblr,
        flickr: found.flickr,
        vsco: found.vscoGrid,
        vimeo: found.vimeo,
        blog: found.blog,
        bluesky: found.bluesky,
        threads: found.threads,
        linkedin: found.linkedin,
      }),
      portrait: resolvePortrait(
        found.featuredImage?.node ?? null,
        found.tpjPortraitUrl,
        found.title
      ),
    };
  }

  if (phantomName) {
    const displayName = titleCaseName(phantomName);
    return {
      id: `phantom:${slug}`,
      name: displayName,
      slug,
      bio: "",
      interviewCount: count,
      socials: [],
      portrait: resolvePortrait(phantomArticleImage, null, displayName),
    };
  }

  return null;
}

export async function fetchPhotographerBySlug(
  slug: string
): Promise<Photographer | null> {
  const data = await wpClient.request<Response>(PhotographerBySlugQuery, {
    slug,
  });
  const raw = data.photographer;
  if (!raw) {
    return derivePhotographerFromArticles(slug);
  }

  return {
    id: raw.id,
    name: titleCaseName(raw.title),
    slug: raw.slug,
    bio: raw.content ? htmlToPlainText(raw.content) : "",
    interviewCount: raw.interviewCount ?? 0,
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
