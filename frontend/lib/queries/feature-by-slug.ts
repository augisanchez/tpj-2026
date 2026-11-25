import { splitEditorialNote } from "@/lib/editorial-note";
import { gql } from "graphql-request";
import { wpClient, wpPreviewClient } from "../api";
import type { PreviewTarget } from "../preview";
import { prepareArticleBodyHtml, rewriteMediaUrl } from "../media";
import type { Essay } from "./essay-by-slug";
import type { Photographer } from "@/lib/photographer-types";
import {
  LinkedPhotographerFields,
  LinkedPhotographersFields,
  resolveArticlePhotographers,
  stripPhotographerBlob,
  splitCredits,
  type RawLinkedPhotographer,
} from "./linked-photographer";

const FeatureBySlugQuery = gql`
  query FeatureBySlug($slug: ID!, $idType: FeatureIdType = SLUG, $asPreview: Boolean = false) {
    feature(id: $slug, idType: $idType, asPreview: $asPreview) {
      id
      title
      slug
      date
      dateGmt
      content
      excerpt
      articleIntro
      articleAuthor
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

/**
 * Feature posts can carry a writer credit in addition to (or
 * instead of) a photographer credit — book reviews, travel essays,
 * etc. Stored as `tpj_byline_author` post meta with legacy fallback
 * to `tpj_feature_writer`; exposed by WPGraphQL as `articleAuthor`.
 */
export type Feature = Essay & {
  writer: string | null;
};

type RawHeroImage = {
  sourceUrl: string | null;
  altText: string | null;
  mediaDetails?: { width: number | null; height: number | null } | null;
} | null;

type RawFeature = {
  id: string;
  title: string;
  slug: string;
  date: string;
  dateGmt?: string | null;
  content: string | null;
  excerpt: string | null;
  articleIntro: string | null;
  articleAuthor: string | null;
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

type Response = { feature: RawFeature | null };

export async function fetchFeatureBySlug(
  slug: string,
  preview?: PreviewTarget
): Promise<Feature | null> {
  let raw: RawFeature | null;
  if (preview) {
    const vars = { slug: String(preview.id), idType: "DATABASE_ID" };
    raw = (await wpPreviewClient.request<Response>(FeatureBySlugQuery, { ...vars, asPreview: preview.asPreview })).feature;
    // No autosave yet: fall back to the saved post.
    if (!raw && preview.asPreview) raw = (await wpPreviewClient.request<Response>(FeatureBySlugQuery, vars)).feature;
  } else {
    raw = (await wpClient.request<Response>(FeatureBySlugQuery, { slug })).feature;
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

  const rawBody = raw.content
    ? prepareArticleBodyHtml(raw.content, {
        credit: photographers.map((p) => p.name).filter(Boolean).join(" and ") || photographerNameTrimmed,
      })
    : "";
  const { body, credits } = splitCredits(
    photographers.length > 0 ? stripPhotographerBlob(rawBody) : rawBody
  );

  const { intro, note: editorialNote } = splitEditorialNote(
    raw.articleIntro ? raw.articleIntro.trim() : null
  );
  const writer = raw.articleAuthor ? raw.articleAuthor.trim() || null : null;
  const hero = raw.heroImage;
  const heroSrc = hero ? rewriteMediaUrl(hero.sourceUrl) : null;

  return {
    id: raw.id,
    title: raw.title,
    slug: raw.slug,
    date: raw.date,
    dateGmt: raw.dateGmt ?? null,
    body,
    credits,
    excerpt: raw.excerpt,
    intro: intro || null,
    editorialNote,
    photographerName: photographerNameTrimmed,
    photographer: photographers[0] ?? null,
    photographers,
    writer,
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
