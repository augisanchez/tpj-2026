import { gql } from "graphql-request";
import { wpClient } from "../api";
import { rewriteMediaUrl } from "../media";
import { htmlToPlainText } from "../text-utils";
import { fetchPhotographerArticles } from "./photographer-articles";

/**
 * Photographers flagged "Feature on homepage" in wp-admin
 * (tpj_featured_photographer, resolved by `featuredPhotographers` in
 * inc/graphql.php), random order. The homepage hero features the first.
 */
const FeaturedPhotographersQuery = gql`
  query FeaturedPhotographers($first: Int = 1) {
    featuredPhotographers(first: $first) {
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
`;

type Raw = {
  title: string;
  slug: string;
  content: string | null;
  tpjPortraitUrl: string | null;
  featuredImage: { node: { sourceUrl: string | null; altText: string | null } | null } | null;
};

export type FeaturedPhotographer = {
  name: string;
  slug: string;
  bio: string;
  /** One full-size image: their only story's cover, else their portrait. */
  image: { src: string; alt: string } | null;
  /** True when `image` is the portrait (keep the face in frame). */
  imageIsPortrait: boolean;
  /** With two or more stories: a 2×2 of their work with the portrait. */
  collage: { src: string; alt: string }[] | null;
};

export async function fetchFeaturedPhotographer(): Promise<FeaturedPhotographer | null> {
  const data = await wpClient.request<{ featuredPhotographers: Raw[] | null }>(
    FeaturedPhotographersQuery,
    { first: 1 }
  );
  const raw = data.featuredPhotographers?.[0];
  if (!raw) return null;

  const portraitSrc = rewriteMediaUrl(
    raw.featuredImage?.node?.sourceUrl ?? raw.tpjPortraitUrl ?? null
  );
  // Portraits are too small to fill the hero on their own. Their work
  // carries it. Rules:
  // - Work means photographs they made: photo essay and feature covers.
  //   An interview's cover is usually a photograph OF them, so it counts
  //   as a portrait, never as work.
  // - No image appears twice (the same upload often serves as both the
  //   portrait and an interview cover).
  // - A collage needs two or more distinct pieces of work; otherwise the
  //   hero shows one image: their work, else a portrait.
  const articles = (await fetchPhotographerArticles(raw.slug).catch(() => null))?.articles ?? [];
  const seen = new Set<string>();
  const once = (img: { src: string; alt: string } | null) => {
    if (!img) return null;
    const id = imageIdentity(img.src);
    if (seen.has(id)) return null;
    seen.add(id);
    return img;
  };
  const work = articles
    .filter((a) => a.featuredImage && a.contentType !== "interview")
    .map((a) => once({ src: a.featuredImage!.src, alt: a.title }))
    .filter((x): x is { src: string; alt: string } => !!x);
  const portrait =
    once(portraitSrc ? { src: portraitSrc, alt: raw.title } : null) ??
    articles
      .filter((a) => a.featuredImage && a.contentType === "interview")
      .map((a) => once({ src: a.featuredImage!.src, alt: raw.title }))
      .find(Boolean) ??
    null;

  let collage: { src: string; alt: string }[] | null = null;
  if (work.length >= 2) {
    // Cells run top-left, top-right, bottom-left, bottom-right. The text
    // sits bottom left, so the portrait takes the top right.
    collage = portrait ? [work[0], portrait, ...work.slice(1, 3)] : work.slice(0, 4);
  }
  const image = work[0] ?? portrait;

  return {
    name: raw.title,
    slug: raw.slug,
    bio: raw.content ? htmlToPlainText(raw.content) : "",
    image,
    imageIsPortrait: !work.length && !!image,
    collage,
  };
}

/** Same upload, whatever the size variant or host: "IMG_4070-1024x683.jpg" and "IMG_4070.jpg" match. */
function imageIdentity(src: string): string {
  const file = (src.split("?")[0].split("/").pop() ?? src).toLowerCase();
  return file.replace(/-(\d+x\d+|scaled|e\d{10,})(?=\.[a-z0-9]+$)/g, "");
}
