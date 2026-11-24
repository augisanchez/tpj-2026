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

const EssayBySlugQuery = gql`
  query EssayBySlug($slug: ID!, $idType: EssayIdType = SLUG, $asPreview: Boolean = false) {
    essay(id: $slug, idType: $idType, asPreview: $asPreview) {
      id
      title
      slug
      date
      dateGmt
      content
      excerpt
      articleIntro
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

export type Essay = {
  id: string;
  title: string;
  slug: string;
  date: string;
  dateGmt?: string | null;
  body: string;
  excerpt: string | null;
  intro: string | null;
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

type RawEssay = {
  id: string;
  title: string;
  slug: string;
  date: string;
  dateGmt?: string | null;
  content: string | null;
  excerpt: string | null;
  articleIntro: string | null;
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

type Response = { essay: RawEssay | null };

export async function fetchEssayBySlug(
  slug: string,
  preview?: PreviewTarget
): Promise<Essay | null> {
  let raw: RawEssay | null;
  if (preview) {
    const vars = { slug: String(preview.id), idType: "DATABASE_ID" };
    raw = (await wpPreviewClient.request<Response>(EssayBySlugQuery, { ...vars, asPreview: preview.asPreview })).essay;
    // No autosave yet: fall back to the saved post.
    if (!raw && preview.asPreview) raw = (await wpPreviewClient.request<Response>(EssayBySlugQuery, vars)).essay;
  } else {
    raw = (await wpClient.request<Response>(EssayBySlugQuery, { slug })).essay;
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

  const hero = raw.heroImage;
  const heroSrc = hero ? rewriteMediaUrl(hero.sourceUrl) : null;

  return {
    id: raw.id,
    title: raw.title,
    slug: raw.slug,
    date: raw.date,
    dateGmt: raw.dateGmt ?? null,
    body,
    excerpt: raw.excerpt,
    intro: intro || null,
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
