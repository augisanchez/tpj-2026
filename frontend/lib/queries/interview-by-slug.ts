import { gql } from "graphql-request";
import { wpClient, wpPreviewClient } from "../api";
import type { PreviewTarget } from "../preview";
import { prepareArticleBodyHtml, rewriteMediaUrl } from "../media";
import type { Photographer } from "@/lib/photographer-types";
import type { FeaturedImage } from "./recent-essays";
import {
  LinkedPhotographerFields,
  LinkedPhotographersFields,
  resolveArticlePhotographers,
  stripPhotographerBlob,
  type RawLinkedPhotographer,
} from "./linked-photographer";

const InterviewBySlugQuery = gql`
  query InterviewBySlug($slug: ID!, $idType: InterviewIdType = SLUG, $asPreview: Boolean = false) {
    interview(id: $slug, idType: $idType, asPreview: $asPreview) {
      id
      title
      slug
      date
      content
      excerpt
      articleIntro
      articleAuthor
      portraitCredit
      photographerName
      ${LinkedPhotographerFields}
      ${LinkedPhotographersFields}
      featuredImage {
        node {
          sourceUrl
          altText
          mediaDetails {
            width
            height
          }
        }
      }
      heroImage {
        sourceUrl
        altText
        mediaDetails {
          width
          height
        }
      }
    }
  }
`;

export type Interview = {
  id: string;
  title: string;
  slug: string;
  date: string;
  body: string;
  excerpt: string | null;
  intro: string | null;
  interviewer: string | null;
  /** e.g. "Portraits of Olivia Bee by Joe Haeberle". */
  portraitCredit: string | null;
  photographerName: string | null;
  photographer: Photographer | null;
  photographers: Photographer[];
  featuredImage: FeaturedImage | null;
  heroImage: FeaturedImage | null;
};

type RawHeroImage = {
  sourceUrl: string | null;
  altText: string | null;
  mediaDetails?: { width: number | null; height: number | null } | null;
} | null;

type RawInterview = {
  id: string;
  title: string;
  slug: string;
  date: string;
  content: string | null;
  excerpt: string | null;
  articleIntro: string | null;
  articleAuthor: string | null;
  portraitCredit?: string | null;
  photographerName: string | null;
  linkedPhotographer: RawLinkedPhotographer | null;
  linkedPhotographers: RawLinkedPhotographer[] | null;
  featuredImage: {
    node: {
      sourceUrl: string | null;
      altText: string | null;
      mediaDetails?: { width: number | null; height: number | null } | null;
    } | null;
  } | null;
  heroImage: RawHeroImage;
};

type Response = { interview: RawInterview | null };

export async function fetchInterviewBySlug(
  slug: string,
  preview?: PreviewTarget
): Promise<Interview | null> {
  let raw: RawInterview | null;
  if (preview) {
    const vars = { slug: String(preview.id), idType: "DATABASE_ID" };
    raw = (await wpPreviewClient.request<Response>(InterviewBySlugQuery, { ...vars, asPreview: preview.asPreview })).interview;
    // No autosave yet: fall back to the saved post.
    if (!raw && preview.asPreview) raw = (await wpPreviewClient.request<Response>(InterviewBySlugQuery, vars)).interview;
  } else {
    raw = (await wpClient.request<Response>(InterviewBySlugQuery, { slug })).interview;
  }
  if (!raw) return null;

  const fi = raw.featuredImage?.node;
  const featuredSrc = fi ? rewriteMediaUrl(fi.sourceUrl) : null;
  const photographerNameTrimmed = raw.photographerName?.trim() || null;
  const photographers = resolveArticlePhotographers({
    linkedPhotographers: raw.linkedPhotographers,
    linkedPhotographer: raw.linkedPhotographer,
    photographerName: photographerNameTrimmed,
  });

  const rawBody = raw.content ? prepareArticleBodyHtml(raw.content) : "";
  const body = photographers.length > 0 ? stripPhotographerBlob(rawBody) : rawBody;

  const intro = raw.articleIntro ? raw.articleIntro.trim() : null;
  const interviewer = raw.articleAuthor ? raw.articleAuthor.trim() : null;
  const hero = raw.heroImage;
  const heroSrc = hero ? rewriteMediaUrl(hero.sourceUrl) : null;

  return {
    id: raw.id,
    title: raw.title,
    slug: raw.slug,
    date: raw.date,
    body,
    excerpt: raw.excerpt,
    intro: intro || null,
    interviewer: interviewer || null,
    portraitCredit: raw.portraitCredit?.trim() || null,
    photographerName: photographerNameTrimmed,
    photographer: photographers[0] ?? null,
    photographers,
    featuredImage: featuredSrc
      ? {
          src: featuredSrc,
          alt: fi?.altText || raw.title,
          width: fi?.mediaDetails?.width ?? undefined,
          height: fi?.mediaDetails?.height ?? undefined,
        }
      : null,
    heroImage: heroSrc
      ? {
          src: heroSrc,
          alt: hero?.altText || raw.title,
          width: hero?.mediaDetails?.width ?? undefined,
          height: hero?.mediaDetails?.height ?? undefined,
        }
      : null,
  };
}
