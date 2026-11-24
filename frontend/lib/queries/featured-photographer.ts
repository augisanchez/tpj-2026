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
  /** Their portrait, else the cover of their most recent work. */
  image: { src: string; alt: string } | null;
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
  // Only look up their work when there's no portrait to show.
  const cover = portraitSrc
    ? null
    : (await fetchPhotographerArticles(raw.slug).catch(() => null))?.articles.find(
        (a) => a.featuredImage
      )?.featuredImage ?? null;

  return {
    name: raw.title,
    slug: raw.slug,
    bio: raw.content ? htmlToPlainText(raw.content) : "",
    image: portraitSrc ? { src: portraitSrc, alt: raw.title } : cover,
  };
}
