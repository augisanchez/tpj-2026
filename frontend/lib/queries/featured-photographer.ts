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
  // carries it: one story's cover full-size, or a collage of their work
  // with the portrait once there are two or more.
  const work = ((await fetchPhotographerArticles(raw.slug).catch(() => null))?.articles ?? [])
    .filter((a) => a.featuredImage)
    .map((a) => ({ src: a.featuredImage!.src, alt: a.title }));
  const portrait = portraitSrc ? { src: portraitSrc, alt: raw.title } : null;

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
    imageIsPortrait: !work.length && !!portrait,
    collage,
  };
}
