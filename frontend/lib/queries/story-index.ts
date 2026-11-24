import { gql } from "graphql-request";
import { unstable_cache } from "next/cache";
import { wpClient } from "../api";
import { rewriteMediaUrl } from "../media";
import { htmlToInlineText } from "../text-utils";
import { resolvePhotographerCredit } from "./recent-essays";

export type StoryType = "essay" | "interview" | "feature";

/** One published story, as the numbered index and /random need it. */
export type IndexStory = {
  /** Sequential catalogue number: the oldest story is No. 1. */
  no: number;
  title: string;
  slug: string;
  type: StoryType;
  year: number;
  photographer: string | null;
  image: string | null;
};

// One content type per request, small pages, one request at a time:
// the CMS is a 1 GB server (same reasoning as lib/queries/explore.ts).
const PAGE = 100;
const LIST_FIELD = { essay: "essays", interview: "interviews", feature: "features" } as const;

function pagedQuery(field: string) {
  return gql`
    query StoryIndexPage($first: Int!, $after: String) {
      ${field}(
        first: $first
        after: $after
        where: { status: PUBLISH, orderby: { field: DATE, order: DESC } }
      ) {
        pageInfo { hasNextPage endCursor }
        nodes {
          title
          slug
          date
          photographerName
          linkedPhotographer { title }
          linkedPhotographers { title }
          featuredImage { node { sourceUrl } }
        }
      }
    }
  `;
}

type RawNode = {
  title: string;
  slug: string;
  date: string;
  photographerName: string | null;
  linkedPhotographer: { title: string | null } | null;
  linkedPhotographers: { title: string | null }[] | null;
  featuredImage: { node: { sourceUrl: string | null } | null } | null;
};

type PageResponse = Record<
  string,
  { pageInfo: { hasNextPage: boolean; endCursor: string | null }; nodes: RawNode[] }
>;

async function fetchType(type: StoryType) {
  const field = LIST_FIELD[type];
  const query = pagedQuery(field);
  const out: (Omit<IndexStory, "no"> & { date: string })[] = [];
  let after: string | null = null;
  for (let guard = 0; guard < 50; guard++) {
    const data: PageResponse = await wpClient.request<PageResponse>(query, { first: PAGE, after });
    const page = data[field];
    for (const n of page.nodes) {
      out.push({
        title: htmlToInlineText(n.title),
        slug: n.slug,
        type,
        date: n.date,
        year: new Date(n.date).getFullYear(),
        photographer: resolvePhotographerCredit(n),
        image: rewriteMediaUrl(n.featuredImage?.node?.sourceUrl),
      });
    }
    if (!page.pageInfo.hasNextPage || !page.pageInfo.endCursor) break;
    after = page.pageInfo.endCursor;
  }
  return out;
}

async function loadStoryIndex(): Promise<IndexStory[]> {
  // Sequential on purpose: one modest request at a time for the CMS.
  const essays = await fetchType("essay");
  const interviews = await fetchType("interview");
  const features = await fetchType("feature");
  const all = [...essays, ...interviews, ...features].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );
  // Oldest first for numbering, then newest first for display.
  return all
    .map((s, i) => ({
      no: i + 1,
      title: s.title,
      slug: s.slug,
      type: s.type,
      year: s.year,
      photographer: s.photographer,
      image: s.image,
    }))
    .reverse();
}

/**
 * Every published essay, interview and feature, newest first, numbered
 * oldest = No. 1. Cached for an hour as one small entry, so /index,
 * /random and the 404 photo share it and the CMS sees at most one
 * rebuild per hour.
 */
export const fetchStoryIndex = unstable_cache(loadStoryIndex, ["story-index-v1"], {
  revalidate: 3600,
  tags: ["story-index"],
});

/** One story at random (optionally only those with a photograph), or
 *  null if the list is unavailable. Never cached: the pick is per call. */
export async function randomStory(opts: { withImage?: boolean; avoidPath?: string } = {}) {
  const all = await fetchStoryIndex().catch(() => [] as IndexStory[]);
  const pool = opts.withImage ? all.filter((s) => s.image) : all;
  if (!pool.length) return null;
  let pick = pool[Math.floor(Math.random() * pool.length)];
  for (let i = 0; i < 3 && opts.avoidPath?.endsWith(`/${pick.type}/${pick.slug}`); i++) {
    pick = pool[Math.floor(Math.random() * pool.length)];
  }
  return pick;
}
