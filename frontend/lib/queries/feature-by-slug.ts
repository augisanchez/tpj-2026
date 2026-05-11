import { gql } from "graphql-request";
import { wpClient } from "../api";
import { rewriteMediaUrl, rewriteMediaUrlsInHtml } from "../media";
import type { Essay } from "./essay-by-slug";
import type { Photographer } from "@/lib/photographer-types";
import {
  LinkedPhotographerFields,
  LinkedPhotographersFields,
  resolveArticlePhotographers,
  stripPhotographerBlob,
  type RawLinkedPhotographer,
} from "./linked-photographer";

const FeatureBySlugQuery = gql`
  query FeatureBySlug($slug: ID!) {
    feature(id: $slug, idType: SLUG) {
      id
      title
      slug
      date
      content
      excerpt
      articleIntro
      photographerName
      tpjFeatureWriter
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
    }
  }
`;

/**
 * Feature posts can carry a writer/author credit in addition to (or
 * instead of) a photographer credit — book reviews, travel essays,
 * etc. The writer name comes from `tpj_feature_writer` post meta and
 * is exposed by WPGraphQL as `tpjFeatureWriter`.
 */
export type Feature = Essay & {
  writer: string | null;
};

type RawFeature = {
  id: string;
  title: string;
  slug: string;
  date: string;
  content: string | null;
  excerpt: string | null;
  articleIntro: string | null;
  photographerName: string | null;
  tpjFeatureWriter: string | null;
  linkedPhotographer: RawLinkedPhotographer | null;
  linkedPhotographers: RawLinkedPhotographer[] | null;
  featuredImage: {
    node: {
      sourceUrl: string | null;
      altText: string | null;
      mediaDetails?: { width: number | null; height: number | null } | null;
    } | null;
  } | null;
};

type Response = { feature: RawFeature | null };

export async function fetchFeatureBySlug(slug: string): Promise<Feature | null> {
  const data = await wpClient.request<Response>(FeatureBySlugQuery, { slug });
  const raw = data.feature;
  if (!raw) return null;

  const fi = raw.featuredImage?.node;
  const featuredSrc = fi ? rewriteMediaUrl(fi.sourceUrl) : null;
  const photographerNameTrimmed = raw.photographerName?.trim() || null;
  const photographers = resolveArticlePhotographers({
    linkedPhotographers: raw.linkedPhotographers,
    linkedPhotographer: raw.linkedPhotographer,
    photographerName: photographerNameTrimmed,
  });

  const rawBody = raw.content ? rewriteMediaUrlsInHtml(raw.content) : "";
  const body = photographers.length > 0 ? stripPhotographerBlob(rawBody) : rawBody;

  const intro = raw.articleIntro ? raw.articleIntro.trim() : null;

  const writer = raw.tpjFeatureWriter
    ? raw.tpjFeatureWriter.trim() || null
    : null;

  return {
    id: raw.id,
    title: raw.title,
    slug: raw.slug,
    date: raw.date,
    body,
    excerpt: raw.excerpt,
    intro: intro || null,
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
  };
}
