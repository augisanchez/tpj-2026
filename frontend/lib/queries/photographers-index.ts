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

/**
 * How a person appears in the journal. Photographer: credited on an
 * essay or feature. Interviewed: the subject of an interview.
 * Interviewer / Writer: named in an interview's / feature's byline.
 * Models are deliberately not a role here.
 */
export type ArtistRole = "photographer" | "interviewed" | "interviewer" | "writer";

export type RoleCounts = {
  photographs: number;
  interviews: number;
  conducted: number;
  written: number;
};

export type PhotographerIndexItem = {
  id: string;
  name: string;
  slug: string;
  bioPreview: string;
  articleCount: number;
  /** Pieces someone else shot that this photographer appears in. */
  appearsInCount?: number;
  roles?: ArtistRole[];
  counts?: RoleCounts;
  portrait: { src: string; alt: string } | null;
};

const BIO_PREVIEW_MAX = 100;

/** Every published article's credited people and byline, for roles. */
const PeopleRolesQuery = gql`
  query PeopleRoles {
    essays(first: 1000, where: { status: PUBLISH }) {
      nodes { linkedPhotographers { slug } }
    }
    interviews(first: 1000, where: { status: PUBLISH }) {
      nodes { linkedPhotographers { slug } articleAuthor }
    }
    features(first: 1000, where: { status: PUBLISH }) {
      nodes { linkedPhotographers { slug } articleAuthor }
    }
  }
`;

type RoleNode = { linkedPhotographers?: { slug: string | null }[] | null; articleAuthor?: string | null };
type RolesResponse = {
  essays: { nodes: RoleNode[] };
  interviews: { nodes: RoleNode[] };
  features: { nodes: RoleNode[] };
};

/** Byline names split the way WordPress splits them ("A and B", "A, B & C"). */
export function bylineSlugs(byline: string | null | undefined): string[] {
  return (byline ?? "")
    .split(/\s*(?:&|,|;|\s+and\s+)\s*/i)
    .map((n) => slugifyName(n.trim()))
    .filter(Boolean);
}

async function fetchRoleCounts(): Promise<Map<string, RoleCounts>> {
  const data = await wpClient.request<RolesResponse>(PeopleRolesQuery);
  const map = new Map<string, RoleCounts>();
  const bump = (slug: string | null | undefined, key: keyof RoleCounts) => {
    if (!slug) return;
    const c = map.get(slug) ?? { photographs: 0, interviews: 0, conducted: 0, written: 0 };
    c[key] += 1;
    map.set(slug, c);
  };
  const credited = (n: RoleNode) => [...new Set((n.linkedPhotographers ?? []).map((l) => l.slug))];
  for (const n of data.essays?.nodes ?? []) credited(n).forEach((s) => bump(s, "photographs"));
  for (const n of data.features?.nodes ?? []) {
    credited(n).forEach((s) => bump(s, "photographs"));
    [...new Set(bylineSlugs(n.articleAuthor))].forEach((s) => bump(s, "written"));
  }
  for (const n of data.interviews?.nodes ?? []) {
    credited(n).forEach((s) => bump(s, "interviews"));
    [...new Set(bylineSlugs(n.articleAuthor))].forEach((s) => bump(s, "conducted"));
  }
  return map;
}

function rolesFrom(c: RoleCounts | undefined): ArtistRole[] {
  if (!c) return [];
  const r: ArtistRole[] = [];
  if (c.photographs) r.push("photographer");
  if (c.interviews) r.push("interviewed");
  if (c.conducted) r.push("interviewer");
  if (c.written) r.push("writer");
  return r;
}

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
  appearsInCount?: number | null;
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
  const [data, roleCounts] = await Promise.all([
    wpClient.request<Response>(PhotographersIndexQuery),
    fetchRoleCounts().catch(() => new Map<string, RoleCounts>()),
  ]);
  const items = (data.photographers?.nodes ?? []).map(
    (node): PhotographerIndexItem => {
      const name = titleCaseName(node.title);
      const cptPortrait = resolveCptPortrait(node);
      const counts = roleCounts.get(node.slug);
      return {
        id: node.id,
        name,
        slug: node.slug,
        bioPreview: bioPreview(node.content),
        articleCount: node.linkedArticleCount ?? node.interviewCount ?? 0,
        appearsInCount: node.appearsInCount ?? 0,
        roles: rolesFrom(counts),
        counts,
        portrait: cptPortrait
          ? { src: cptPortrait.src, alt: cptPortrait.alt || name }
          : null,
      };
    }
  );

  if (items.length > 0) {
    items.sort((a, b) => a.name.localeCompare(b.name));
    // Listed: anyone with published work in any role. A record whose
    // only article is a draft would lead to an empty page. Appearing in
    // someone else's essay (modeling) alone doesn't list a person.
    return items.filter((i) => (i.roles?.length ?? 0) > 0 || (roleCounts.size === 0 && i.articleCount > 0));
  }

  return deriveIndexFromArticles();
}
