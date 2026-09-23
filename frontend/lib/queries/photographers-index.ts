import { gql } from "graphql-request";
import { wpClient } from "../api";
import { rewriteMediaUrl } from "../media";
import { htmlToInlineText, slugifyName, titleCaseName } from "../text-utils";

const PhotographersIndexQuery = gql`
  query PhotographersIndex {
    photographers(first: 1000, where: { status: PUBLISH }) {
      nodes {
        id
        title
        slug
        content
        linkedArticleCount
        interviewCount
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

/**
 * Fallback path: until the Photographer CPT migration runs (`wp tpj
 * migrate-photographers` and `migrate-photographer-blocks`), the CPT
 * itself is empty. Even after the migration, contributors whose bio
 * blocks the parser couldn't recognize have no `linkedPhotographer` set
 * but still carry a `photographerName` on each article (from the v1 ACF
 * field or first post tag). We aggregate from both: linkedPhotographer
 * when available, photographerName-based "phantom" entry otherwise. The
 * phantom slug is derived from the name so the detail page can resolve
 * the same set of articles by matching photographerName.
 */
const PhotographersFromArticlesQuery = gql`
  query PhotographersFromArticles($first: Int = 500) {
    essays(first: $first, where: { status: PUBLISH }) {
      nodes {
        id
        photographerName
        linkedPhotographer {
          id
          title
          slug
          content
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
    interviews(first: $first, where: { status: PUBLISH }) {
      nodes {
        id
        photographerName
        linkedPhotographer {
          id
          title
          slug
          content
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
    features(first: $first, where: { status: PUBLISH }) {
      nodes {
        id
        photographerName
        linkedPhotographer {
          id
          title
          slug
          content
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
  }
`;

export type PhotographerIndexItem = {
  id: string;
  name: string;
  slug: string;
  bioPreview: string;
  articleCount: number;
  portrait: { src: string; alt: string } | null;
};

const BIO_PREVIEW_MAX = 100;

function bioPreview(html: string | null | undefined): string {
  const plain = htmlToInlineText(html);
  if (!plain) return "";
  if (plain.length <= BIO_PREVIEW_MAX) return plain;
  const cut = plain.slice(0, BIO_PREVIEW_MAX);
  const lastSpace = cut.lastIndexOf(" ");
  const trimmed =
    lastSpace > BIO_PREVIEW_MAX * 0.6 ? cut.slice(0, lastSpace) : cut;
  return trimmed.trimEnd() + "…";
}

type Raw = {
  id: string;
  title: string;
  slug: string;
  content: string | null;
  linkedArticleCount: number | null;
  interviewCount: number | null;
  tpjPortraitUrl: string | null;
  featuredImage: {
    node: { sourceUrl: string | null; altText: string | null } | null;
  } | null;
};

type Response = { photographers: { nodes: Raw[] } };

type LinkedPhotographer = {
  id: string;
  title: string;
  slug: string;
  content: string | null;
  tpjPortraitUrl: string | null;
  featuredImage: {
    node: { sourceUrl: string | null; altText: string | null } | null;
  } | null;
};

type FallbackNode = {
  id: string;
  photographerName: string | null;
  linkedPhotographer: LinkedPhotographer | null;
};

type FallbackResponse = {
  essays: { nodes: FallbackNode[] };
  interviews: { nodes: FallbackNode[] };
  features: { nodes: FallbackNode[] };
};

type AggregateEntry = {
  kind: "linked" | "phantom";
  lp: LinkedPhotographer | null;
  slug: string;
  name: string;
  count: number;
  id: string;
};

function resolveImage(
  fi: { sourceUrl: string | null; altText: string | null } | null | undefined,
  altFallback: string
): { src: string; alt: string } | null {
  if (!fi) return null;
  const src = rewriteMediaUrl(fi.sourceUrl);
  if (!src) return null;
  return { src, alt: fi.altText || altFallback };
}

/**
 * Portrait resolution for a CPT-backed photographer record. Only true
 * photographer-of-the-person sources count: Featured Image, then the
 * legacy tpjPortraitUrl. We deliberately do NOT fall back to an article
 * thumbnail here — that would show a photo of the photographer's
 * *work* under their name on the directory, which reads as a portrait
 * and misleads. Missing portraits surface as initials via
 * PhotographerAvatar.
 */
function resolveCptPortrait(raw: Raw): { src: string; alt: string } | null {
  const fromFeatured = resolveImage(raw.featuredImage?.node, raw.title);
  if (fromFeatured) return fromFeatured;
  const fromBlob = raw.tpjPortraitUrl
    ? rewriteMediaUrl(raw.tpjPortraitUrl)
    : null;
  if (fromBlob) return { src: fromBlob, alt: raw.title };
  return null;
}

function resolvePortrait(
  lp: LinkedPhotographer
): { src: string; alt: string } | null {
  const fromFeatured = resolveImage(lp.featuredImage?.node, lp.title);
  if (fromFeatured) return fromFeatured;
  const fromBlob = lp.tpjPortraitUrl
    ? { src: rewriteMediaUrl(lp.tpjPortraitUrl) ?? "", alt: lp.title }
    : null;
  if (fromBlob && fromBlob.src) return fromBlob;
  return null;
}

async function deriveIndexFromArticles(): Promise<PhotographerIndexItem[]> {
  const data = await wpClient.request<FallbackResponse>(
    PhotographersFromArticlesQuery,
    { first: 500 }
  );

  const map = new Map<string, AggregateEntry>();

  const collect = (nodes: FallbackNode[]) => {
    for (const n of nodes) {
      const lp = n.linkedPhotographer;

      let key: string | null = null;
      let nextEntry: AggregateEntry | null = null;

      if (lp && lp.slug) {
        key = lp.slug;
        nextEntry = {
          kind: "linked",
          lp,
          slug: lp.slug,
          name: lp.title,
          count: 0,
          id: lp.id,
        };
      } else if (n.photographerName) {
        const phantomSlug = slugifyName(n.photographerName);
        if (!phantomSlug) continue;
        key = phantomSlug;
        nextEntry = {
          kind: "phantom",
          lp: null,
          slug: phantomSlug,
          name: n.photographerName,
          count: 0,
          id: `phantom:${phantomSlug}`,
        };
      } else {
        continue;
      }

      const existing = map.get(key);
      if (existing) {
        existing.count += 1;
        // Upgrade a phantom entry to linked if a later article has the
        // CPT record. Keeps richer data when both forms appear in the
        // pool.
        if (existing.kind === "phantom" && nextEntry.kind === "linked") {
          existing.kind = "linked";
          existing.lp = nextEntry.lp;
          existing.slug = nextEntry.slug;
          existing.name = nextEntry.name;
          existing.id = nextEntry.id;
        }
      } else {
        nextEntry.count = 1;
        map.set(key, nextEntry);
      }
    }
  };

  collect(data.essays?.nodes ?? []);
  collect(data.interviews?.nodes ?? []);
  collect(data.features?.nodes ?? []);

  const items: PhotographerIndexItem[] = Array.from(map.values()).map(
    (entry) => ({
      id: entry.id,
      name: titleCaseName(entry.name),
      slug: entry.slug,
      bioPreview:
        entry.kind === "linked" && entry.lp
          ? bioPreview(entry.lp.content)
          : "",
      articleCount: entry.count,
      portrait:
        entry.kind === "linked" && entry.lp
          ? resolvePortrait(entry.lp)
          : null,
    })
  );

  items.sort((a, b) => a.name.localeCompare(b.name));
  return items;
}

export async function fetchPhotographersIndex(): Promise<
  PhotographerIndexItem[]
> {
  const data = await wpClient.request<Response>(PhotographersIndexQuery);
  const items = (data.photographers?.nodes ?? []).map(
    (node): PhotographerIndexItem => {
      const name = titleCaseName(node.title);
      const cptPortrait = resolveCptPortrait(node);
      return {
        id: node.id,
        name,
        slug: node.slug,
        bioPreview: bioPreview(node.content),
        articleCount: node.linkedArticleCount ?? node.interviewCount ?? 0,
        portrait: cptPortrait
          ? { src: cptPortrait.src, alt: cptPortrait.alt || name }
          : null,
      };
    }
  );

  if (items.length > 0) {
    items.sort((a, b) => a.name.localeCompare(b.name));
    return items;
  }

  return deriveIndexFromArticles();
}
