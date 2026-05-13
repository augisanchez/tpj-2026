import { gql } from "graphql-request";
import { wpClient } from "../api";
import { rewriteMediaUrl } from "../media";
import { htmlToInlineText } from "../text-utils";
import { resolvePhotographerCredit } from "./recent-essays";
import type { RecentArticle } from "./recent-articles";

/**
 * Random staff-picked articles. The custom `staffPicks` resolver
 * (inc/graphql.php) returns an array of `ContentNode` interface —
 * the inline fragments below cover all three article CPTs so we get
 * type-appropriate fields per post type.
 *
 * Returns an empty list when no articles are flagged
 * `tpj_staff_pick=1`. The homepage carousel falls back to a 2-slide
 * rotation; Dive Deeper falls back to plain random archival picks.
 */
const StaffPicksQuery = gql`
  query StaffPicks($first: Int = 6) {
    staffPicks(first: $first) {
      __typename
      ... on Essay {
        id
        title
        slug
        date
        excerpt
        photographerName
        linkedPhotographer { title }
        linkedPhotographers { title }
        heroImage {
          sourceUrl
          altText
          mediaDetails { width height }
        }
        featuredImage {
          node {
            sourceUrl
            altText
            mediaDetails { width height }
          }
        }
      }
      ... on Interview {
        id
        title
        slug
        date
        excerpt
        photographerName
        articleAuthor
        linkedPhotographer { title }
        linkedPhotographers { title }
        heroImage {
          sourceUrl
          altText
          mediaDetails { width height }
        }
        featuredImage {
          node {
            sourceUrl
            altText
            mediaDetails { width height }
          }
        }
      }
      ... on Feature {
        id
        title
        slug
        date
        excerpt
        photographerName
        articleAuthor
        linkedPhotographer { title }
        linkedPhotographers { title }
        heroImage {
          sourceUrl
          altText
          mediaDetails { width height }
        }
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

type RawImage = {
  sourceUrl: string | null;
  altText: string | null;
  mediaDetails?: { width: number | null; height: number | null } | null;
} | null;

type RawStaffPick = {
  __typename: "Essay" | "Interview" | "Feature";
  id: string;
  title: string;
  slug: string;
  date: string;
  excerpt: string | null;
  photographerName: string | null;
  articleAuthor?: string | null;
  linkedPhotographer: { title: string | null } | null;
  linkedPhotographers: { title: string | null }[] | null;
  heroImage: RawImage;
  featuredImage: {
    node: RawImage;
  } | null;
};

type Response = { staffPicks: RawStaffPick[] | null };

const TYPE_TO_CONTENT_TYPE: Record<RawStaffPick["__typename"], RecentArticle["contentType"]> = {
  Essay: "essay",
  Interview: "interview",
  Feature: "feature",
};

function cleanExcerpt(html: string | null): string | null {
  if (!html) return null;
  const cleaned = htmlToInlineText(html)
    .replace(/\[…\]/g, "")
    .replace(/Continue reading.*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || null;
}

export type StaffPickArticle = RecentArticle & {
  heroImage: { src: string; alt: string; width?: number; height?: number } | null;
};

function toStaffPickArticle(pick: RawStaffPick): StaffPickArticle {
  const fi = pick.featuredImage?.node;
  const featuredSrc = fi ? rewriteMediaUrl(fi.sourceUrl) : null;
  const hero = pick.heroImage;
  const heroSrc = hero ? rewriteMediaUrl(hero.sourceUrl) : null;

  const photographerName = resolvePhotographerCredit({
    photographerName: pick.photographerName,
    linkedPhotographer: pick.linkedPhotographer,
    linkedPhotographers: pick.linkedPhotographers,
  });

  return {
    id: pick.id,
    title: pick.title,
    slug: pick.slug,
    date: pick.date,
    excerpt: cleanExcerpt(pick.excerpt),
    photographerName,
    contentType: TYPE_TO_CONTENT_TYPE[pick.__typename],
    featuredImage: featuredSrc
      ? {
          src: featuredSrc,
          alt: fi?.altText || pick.title,
          width: fi?.mediaDetails?.width ?? undefined,
          height: fi?.mediaDetails?.height ?? undefined,
        }
      : null,
    heroImage: heroSrc
      ? {
          src: heroSrc,
          alt: hero?.altText || pick.title,
          width: hero?.mediaDetails?.width ?? undefined,
          height: hero?.mediaDetails?.height ?? undefined,
        }
      : null,
  };
}

/**
 * Returns up to `first` random staff-picked articles. Empty array
 * when nothing is currently flagged. Shape extends `RecentArticle`
 * so the homepage carousel and Dive Deeper grid can render staff
 * picks through the same slot/card mechanisms as latest/archival.
 */
export async function fetchStaffPicks(
  first: number = 6
): Promise<StaffPickArticle[]> {
  const data = await wpClient.request<Response>(StaffPicksQuery, { first });
  const picks = data.staffPicks ?? [];
  return picks.map(toStaffPickArticle);
}
