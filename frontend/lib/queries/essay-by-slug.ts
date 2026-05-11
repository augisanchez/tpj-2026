import { gql } from "graphql-request";
import { wpClient } from "../api";
import { rewriteMediaUrl, rewriteMediaUrlsInHtml } from "../media";
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
  query EssayBySlug($slug: ID!) {
    essay(id: $slug, idType: SLUG) {
      id
      title
      slug
      date
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
    }
  }
`;

export type Essay = {
  id: string;
  title: string;
  slug: string;
  date: string;
  body: string;
  excerpt: string | null;
  intro: string | null;
  photographerName: string | null;
  photographer: Photographer | null;
  photographers: Photographer[];
  featuredImage: FeaturedImage | null;
};

type RawEssay = {
  id: string;
  title: string;
  slug: string;
  date: string;
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
};

type Response = { essay: RawEssay | null };

export async function fetchEssayBySlug(slug: string): Promise<Essay | null> {
  const data = await wpClient.request<Response>(EssayBySlugQuery, { slug });
  const raw = data.essay;
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
